//! How the `CrewRoster` capability draws itself in the browser.
//!
//! Seeded once by seans-mfe-tool, then yours. Plain web-sys DOM so the
//! generator picks no UI framework for you — swap in Leptos, Yew or Dioxus
//! here if you want one; `render` is the only thing the platform calls.

use wasm_bindgen::JsValue;
use web_sys::Element;

/// Draw `CrewRoster` into `element`, the slot the shell handed the remote.
///
/// `props` are the placement's props from the control plane, as JSON.
pub fn render(element: &Element, props: &serde_json::Value) -> Result<(), JsValue> {
    let document = element
        .owner_document()
        .ok_or_else(|| JsValue::from_str("the mount element has no document"))?;

    let card = document.create_element("section")?;
    card.set_attribute("data-capability", "CrewRoster")?;
    card.set_attribute("data-rendered-by", "rust-wasm")?;

    let title = document.create_element("h3")?;
    title.set_text_content(Some("CrewRoster"));
    card.append_child(&title)?;

    let description = document.create_element("p")?;
    description.set_text_content(Some("Crew roster with certifications from StationOS joined with payroll standing from StellarLedger"));
    card.append_child(&description)?;

    if let Some(obj) = props.as_object().filter(|o| !o.is_empty()) {
        let detail = document.create_element("pre")?;
        detail.set_text_content(Some(&serde_json::to_string_pretty(obj).unwrap_or_default()));
        card.append_child(&detail)?;
    }

    element.append_child(&card)?;
    Ok(())
}
