use keyring::Entry;
use std::env;

const SERVICE_PREFIX: &str = "DebatePrepSuite";

/// Store a credential in Windows Credential Manager
pub fn store_secret(key_name: &str, secret: &str) -> Result<(), String> {
    let service = format!("{}/{}", SERVICE_PREFIX, key_name);
    let entry = Entry::new(&service, "default_user").map_err(|e| e.to_string())?;
    entry.set_password(secret).map_err(|e| e.to_string())?;
    Ok(())
}

/// Retrieve a credential from Windows Credential Manager, with env var fallback
pub fn get_secret(key_name: &str) -> Result<String, String> {
    // 1. Try Windows Credential Manager
    let service = format!("{}/{}", SERVICE_PREFIX, key_name);
    if let Ok(entry) = Entry::new(&service, "default_user") {
        if let Ok(secret) = entry.get_password() {
            if !secret.trim().is_empty() {
                return Ok(secret);
            }
        }
    }

    // 2. Try Environment Variable fallback
    let env_var_name = match key_name {
        "BraveSearch" => "BRAVE_API_KEY",
        "ZoomClientID" => "ZOOM_CLIENT_ID",
        "ZoomClientSecret" => "ZOOM_CLIENT_SECRET",
        _ => key_name,
    };

    if let Ok(val) = env::var(env_var_name) {
        if !val.trim().is_empty() {
            return Ok(val);
        }
    }

    Err(format!("Credential '{}' not found in Windows Credential Manager or environment", key_name))
}

/// Delete a credential from Windows Credential Manager
pub fn delete_secret(key_name: &str) -> Result<(), String> {
    let service = format!("{}/{}", SERVICE_PREFIX, key_name);
    let entry = Entry::new(&service, "default_user").map_err(|e| e.to_string())?;
    entry.delete_password().map_err(|e| e.to_string())?;
    Ok(())
}
