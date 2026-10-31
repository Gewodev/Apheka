pub fn validate(value:&str)->Result<(),String>{
 let url=reqwest::Url::parse(value).map_err(|_|"El enlace no es válido")?;
 let host=url.host_str().ok_or("El enlace no tiene un servidor válido")?;
 if url.scheme()!="https"||!url.username().is_empty()||url.password().is_some(){return Err("Usa un enlace HTTPS sin credenciales".into());}
 let local=host=="localhost"||host.ends_with(".localhost")||host.ends_with(".local")||!host.contains('.');
 let address=host.trim_matches(['[',']']).parse::<std::net::IpAddr>().ok();
 let private=match address{Some(std::net::IpAddr::V4(ip))=>ip.is_private()||ip.is_loopback()||ip.is_link_local()||ip.is_unspecified()||ip.is_multicast(),Some(std::net::IpAddr::V6(ip))=>ip.is_loopback()||ip.is_unspecified()||ip.is_unique_local()||ip.is_unicast_link_local()||ip.is_multicast(),None=>false};
 if local||private{return Err("Elige un enlace público de audio o vídeo".into());}Ok(())
}
#[cfg(test)]mod tests{use super::*;#[test]fn public_media(){for url in ["https://www.youtube.com/watch?v=abc","https://vimeo.com/123","https://artist.bandcamp.com/track/demo","https://media.example.com/audio.mp3"]{assert!(validate(url).is_ok());}}#[test]fn invalid_sources(){for url in ["file:///C:/private","http://example.com/a","https://name:password@example.com/a","https://127.0.0.1/a","https://192.168.1.1/a","https://localhost/a","https://[::1]/a"]{assert!(validate(url).is_err(),"{url}");}}}
