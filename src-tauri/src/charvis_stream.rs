use serde_json::{json, Value};

/// Provider SSE is transport data, never executable UI or app permissions.
#[derive(Default)]
pub struct Completion {
    pub text: String,
    reasoning: String,
    calls: Vec<Value>,
    pub finished: bool,
    finish_reason: Option<String>,
}
impl Completion {
    pub fn accept(&mut self, data: &str) -> Result<(), String> {
        if data.trim() == "[DONE]" { self.finished = true; return Ok(()); }
        let value: Value = serde_json::from_str(data).map_err(|_| "El proveedor interrumpió el formato del stream.")?;
        if value.get("error").is_some() { return Err("El proveedor interrumpió la consulta. Los cambios ya confirmados se conservan.".into()); }
        let Some(choice) = value["choices"].as_array().and_then(|items|items.first()) else { return Ok(()); };
        let delta = &choice["delta"];
        if let Some(text) = delta["content"].as_str() { self.text.push_str(text); }
        if let Some(text) = delta["reasoning_content"].as_str() { self.reasoning.push_str(text); }
        if let Some(calls) = delta["tool_calls"].as_array() {
            for call in calls {
                let index = call["index"].as_u64().ok_or("Acción del stream sin índice.")? as usize;
                if index >= 12 { return Err("El modelo solicitó demasiadas acciones en un turno.".into()); }
                while self.calls.len() <= index { self.calls.push(json!({"id":"","type":"function","function":{"name":"","arguments":""}})); }
                for (path, part) in [("id", &call["id"]), ("name", &call["function"]["name"]), ("arguments", &call["function"]["arguments"])] {
                    if let Some(text) = part.as_str() {
                        let target = if path == "id" { &mut self.calls[index][path] } else { &mut self.calls[index]["function"][path] };
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
        Ok(json!({"choices":[{"finish_reason":self.finish_reason,"message":{"role":"assistant","content":self.text,"reasoning_content":self.reasoning,"tool_calls":self.calls}}]}))
    }
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
}
