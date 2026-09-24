//! Crew-domain glue shared by this build's renderers — the Rust rendering of
//! the web lane's `src/features/shared/crew.ts`.
//!
//! StationOS knows crew as integer `CrewId 42`; StellarLedger pays them as
//! `crewRef "CRW-0042"`. Both envelopes are unwrapped at the BFF graph, so a
//! renderer reads clean lists from one endpoint — through this MFE's own
//! `query` capability, the same one a host calls (ADR-101).

pub use meridian_crew_services::crew::{cert_color, format_cents, pay_color, to_crew_ref};
use meridian_crew_services::MfeContext;
use serde_json::Value;
use wasm_bindgen::JsValue;
use web_sys::{Document, Element};

/// Run `document` against this MFE's BFF through the `query` capability.
///
/// `query` answers errors rather than failing (ADR-070). A renderer cannot
/// draw a partial answer honestly — `payroll: null` beside an error would
/// read as "nothing owed" — so any error fails here, as the web lane's
/// `platform/bff/bff.ts` `query()` throws on one.
pub async fn query(document: &str) -> Result<Value, String> {
    let mut context = MfeContext::new();
    context
        .inputs
        .insert("document".to_string(), Value::String(document.to_string()));
    let result = crate::platform::mfe()
        .query(context)
        .await
        .map_err(|e| e.to_string())?;
    if !result.errors.is_empty() {
        return Err(result
            .errors
            .iter()
            .map(|e| e.message.as_str())
            .collect::<Vec<_>>()
            .join("\n"));
    }
    result
        .data
        .ok_or_else(|| "the BFF answered no data".to_string())
}

/// The list at `data[key]`, or empty.
pub fn list<'a>(data: &'a Value, key: &str) -> &'a [Value] {
    data.get(key)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

pub fn text<'a>(row: &'a Value, key: &str) -> &'a str {
    row.get(key).and_then(Value::as_str).unwrap_or("")
}

pub fn int(row: &Value, key: &str) -> i64 {
    row.get(key).and_then(Value::as_i64).unwrap_or(0)
}

/// `<tag style="…">text</tag>`, appended to `parent`.
pub fn child(
    document: &Document,
    parent: &Element,
    tag: &str,
    style: &str,
    content: Option<&str>,
) -> Result<Element, JsValue> {
    let element = document.create_element(tag)?;
    if !style.is_empty() {
        element.set_attribute("style", style)?;
    }
    if let Some(content) = content {
        element.set_text_content(Some(content));
    }
    parent.append_child(&element)?;
    Ok(element)
}
