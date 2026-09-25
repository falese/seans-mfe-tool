//! How the `PayStatus` capability draws itself in the browser.
//!
//! Seeded once by seans-mfe-tool, then yours. The status-rail card: payroll
//! that is NOT simply paid — held and scheduled records the crew office needs
//! to chase. The Rust rendering of `src/features/PayStatus/PayStatus.tsx`,
//! reading the same BFF through this MFE's `query` capability.

use serde_json::Value;
use wasm_bindgen::JsValue;
use web_sys::Element;

use crate::crew::{child, format_cents, int, list, pay_color, query, text};

/// The same document `PayStatus.tsx` sends (and `pay_status_query.rs` holds).
const PAY_QUERY: &str = meridian_crew_services::features::pay_status_query::DOCUMENT;

const WRAP: &str = "background:#0e1226;color:#dfe4ff;border-radius:12px;padding:14px;font-family:system-ui,sans-serif";

/// Draw `PayStatus` into `element`, the slot the shell handed the remote.
///
/// The card is drawn at once, in its loading state; the rows arrive when the
/// query answers. `props` carry nothing this card reads.
pub fn render(element: &Element, _props: &Value) -> Result<(), JsValue> {
    let document = element
        .owner_document()
        .ok_or_else(|| JsValue::from_str("the mount element has no document"))?;

    let card = document.create_element("section")?;
    card.set_attribute("data-capability", "PayStatus")?;
    card.set_attribute("data-rendered-by", "rust-wasm")?;
    card.set_attribute("style", WRAP)?;
    child(
        &document,
        &card,
        "h3",
        "margin:0 0 10px;font-size:14px",
        Some("💸 Pay Exceptions"),
    )?;
    let body = child(&document, &card, "div", "", None)?;
    body.set_attribute("data-state", "loading")?;
    child(
        &document,
        &body,
        "p",
        "color:#5d6690;font-size:12px;margin:0",
        Some("Loading payroll…"),
    )?;
    element.append_child(&card)?;

    wasm_bindgen_futures::spawn_local(async move {
        let outcome = query(PAY_QUERY).await;
        // Unmounted while the query was in flight: draw nothing.
        if !card.is_connected() {
            return;
        }
        body.set_text_content(None);
        if let Err(error) = fill(&document, &body, outcome) {
            body.set_text_content(Some(&format!("{:?}", error)));
        }
    });
    Ok(())
}

fn fill(
    document: &web_sys::Document,
    body: &Element,
    outcome: Result<Value, String>,
) -> Result<(), JsValue> {
    let data = match outcome {
        Ok(data) => data,
        Err(error) => {
            body.set_attribute("data-state", "error")?;
            child(
                document,
                body,
                "p",
                "color:#c33b4e;font-size:12px;margin:0",
                Some(&error),
            )?;
            return Ok(());
        }
    };
    body.set_attribute("data-state", "ready")?;

    let open: Vec<&Value> = list(&data, "payroll")
        .iter()
        .filter(|row| text(row, "status") != "PAID")
        .collect();
    if open.is_empty() {
        child(
            document,
            body,
            "p",
            "color:#5d6690;font-size:12px;margin:0",
            Some("All payroll settled."),
        )?;
        return Ok(());
    }
    for row in open {
        let line = child(
            document,
            body,
            "div",
            "display:flex;gap:8px;align-items:baseline;font-size:12px;padding:4px 0;border-bottom:1px solid #141a33",
            None,
        )?;
        line.set_attribute("data-payroll-id", text(row, "payrollId"))?;
        child(
            document,
            &line,
            "span",
            "color:#8b93b5",
            Some(text(row, "crewRef")),
        )?;
        child(
            document,
            &line,
            "span",
            "",
            Some(&format_cents(int(row, "grossCents"))),
        )?;
        let status = text(row, "status");
        child(
            document,
            &line,
            "span",
            &format!(
                "margin-left:auto;color:{};font-weight:700;font-size:10px",
                pay_color(status)
            ),
            Some(status),
        )?;
    }
    Ok(())
}
