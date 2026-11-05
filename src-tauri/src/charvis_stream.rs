use serde_json::{json, Value};

/// Provider SSE is transport data, never executable UI or app permissions.
#[derive(Default)]
pub struct Completion {
    pub text: String,
    reasoning: String,
    calls: Vec<Value>,
    extra_content: Value,
    reasoning_details: Value,
    pub finished: bool,
    finish_reason: Option<String>,
}
impl Completion {
    pub fn accept(&mut self, data: &str) -> Result<(), String> {
        if data.trim() == "[DONE]" { self.finished = true; return Ok(()); }
        let value: Value = serde_json::from_str(data).map_err(|_| "El proveedor interrumpió el formato del stream.")?;
        if value.get("error").is_some() {let status=crate::charvis::error_status(&value,502);return Err(format!("El proveedor interrumpió la consulta (HTTP {status}). {}Los cambios ya confirmados se conservan.",if status==429{format!("[retry-after={}] ",crate::charvis::retry_seconds(None,&value))}else{String::new()}));}
        let Some(choice) = value["choices"].as_array().and_then(|items|items.first()) else { return Ok(()); };
        let delta = &choice["delta"];
        if let Some(text) = delta["content"].as_str() { self.text.push_str(text); }
        if let Some(text) = delta["reasoning_content"].as_str() { self.reasoning.push_str(text); }
        if delta["extra_content"].is_object() { merge_metadata(&mut self.extra_content,&delta["extra_content"]); }
        if delta["reasoning_details"].is_array() { self.reasoning_details=delta["reasoning_details"].clone(); }
        if let Some(calls) = delta["tool_calls"].as_array() {
            for (position,call) in calls.iter().enumerate() {
                // Gemini may send complete tool calls with IDs but without an OpenAI index.
                let index = if let Some(index)=call["index"].as_u64(){index as usize}
                    else if let Some(id)=call["id"].as_str().filter(|id|!id.is_empty()) {self.calls.iter().position(|saved|saved["id"]==id).unwrap_or(self.calls.len())}
                    else if calls.len()>1 {position}
                    else if self.calls.len()<=1 {0}
                    else {return Err("El proveedor envió un fragmento ambiguo de herramientas. No se ejecutó.".into());};
                if index >= 12 { return Err("El modelo solicitó demasiadas acciones en un turno.".into()); }
                while self.calls.len() <= index { self.calls.push(json!({"id":"","type":"function","function":{"name":"","arguments":""}})); }
                if call["extra_content"].is_object(){merge_metadata(&mut self.calls[index]["extra_content"],&call["extra_content"]);}
                if call["reasoning_details"].is_array(){self.calls[index]["reasoning_details"]=call["reasoning_details"].clone();}
                for (path, part) in [("id", &call["id"]), ("name", &call["function"]["name"]), ("arguments", &call["function"]["arguments"])] {
                    if let Some(text) = part.as_str() {
                        let target = if path == "id" { &mut self.calls[index][path] } else { &mut self.calls[index]["function"][path] };
                        if path!="arguments"&&target.as_str()==Some(text){continue;}
                        let joined = target.as_str().unwrap_or("").to_owned() + text; *target = Value::String(joined);
                    }
                }
            }
        }
        if let Some(reason) = choice["finish_reason"].as_str() { self.finish_reason = Some(reason.into()); self.finished = true; }
        Ok(())
    }
    pub fn response(self) -> Result<Value, String> {
        if !self.finished { return Err("La conexión se cerró antes de terminar la respuesta. Puedes volver a enviar el mensaje.".into()); }
        let mut message=json!({"role":"assistant","content":self.text,"reasoning_content":self.reasoning,"tool_calls":self.calls});
        if !self.extra_content.is_null(){message["extra_content"]=self.extra_content;}
        if !self.reasoning_details.is_null(){message["reasoning_details"]=self.reasoning_details;}
        Ok(json!({"choices":[{"finish_reason":self.finish_reason,"message":message}]}))
    }
}
fn merge_metadata(target:&mut Value,incoming:&Value){
    if let Some(fields)=incoming.as_object(){if !target.is_object(){*target=json!({});}for(key,value)in fields{merge_metadata(&mut target[key],value);}}
    else{*target=incoming.clone();}
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn reconstructs_split_text_and_tool_arguments() {
        let mut result = Completion::default();
        result.accept(r#"{"choices":[{"delta":{"content":"Hola ","tool_calls":[{"index":0,"id":"call_a","function":{"name":"read","arguments":"{\"id\":"}}]}}]}"#).unwrap();
        result.accept(r#"{"choices":[{"delta":{"content":"mundo","tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]},"finish_reason":"tool_calls"}]}"#).unwrap();
        let value=result.response().unwrap();
        assert_eq!(value["choices"][0]["message"]["content"],"Hola mundo");
        assert_eq!(value["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"],r#"{"id":"x"}"#);
    }
    #[test] fn rejects_partial_and_invalid_streams() {
        assert!(Completion::default().response().is_err());
        assert!(Completion::default().accept("not json").is_err());
        assert!(Completion::default().accept(r#"{"choices":[{"delta":{"tool_calls":[{"index":100}]}}]}"#).is_err());
    }
    #[test] fn gemini_signature_without_tool_index_is_preserved_exactly() {
        let mut result=Completion::default();
        result.accept(r#"{"choices":[{"delta":{"tool_calls":[{"id":"gemini-call","type":"function","function":{"name":"search","arguments":"{\"query\":\"energy\"}"},"extra_content":{"google":{"thought_signature":"opaque/SIGNED+bytes=="}}}]}}]}"#).unwrap();
        result.accept(r#"{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}"#).unwrap();
        let value=result.response().unwrap();
        assert_eq!(value["choices"][0]["message"]["tool_calls"][0]["extra_content"]["google"]["thought_signature"],"opaque/SIGNED+bytes==");
    }
    #[test] fn parallel_calls_keep_ids_and_signatures_separate() {
        let mut result=Completion::default();
        result.accept(r#"{"choices":[{"delta":{"tool_calls":[{"id":"first","function":{"name":"read","arguments":"{}"},"extra_content":{"google":{"thought_signature":"first-signature"}}},{"id":"second","function":{"name":"list","arguments":"{}"},"extra_content":{"google":{"thought_signature":"second-signature"}}}]}}]}"#).unwrap();
        result.accept(r#"{"choices":[{"delta":{"tool_calls":[{"id":"first","extra_content":{"google":{"thought_signature":"first-signature"}}}]},"finish_reason":"tool_calls"}]}"#).unwrap();
        let value=result.response().unwrap();
        let calls=value["choices"][0]["message"]["tool_calls"].as_array().unwrap();
        assert_eq!(calls.len(),2);
        assert_eq!(calls[0]["id"],"first");
        assert_eq!(calls[0]["extra_content"]["google"]["thought_signature"],"first-signature");
        assert_eq!(calls[1]["extra_content"]["google"]["thought_signature"],"second-signature");
    }
}

#[cfg(test)] mod quota_stream_tests {use super::*;#[test] fn stream_429_preserves_cooldown(){let mut response=Completion::default();let error=response.accept(r#"{"error":{"code":429,"details":[{"retryDelay":"70s"}]}}"#).unwrap_err();assert!(error.contains("HTTP 429"));assert!(error.contains("[retry-after=70]"));}}
