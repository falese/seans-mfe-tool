//! How the `CrewRoster` capability draws itself in the browser.
//!
//! Seeded once by seans-mfe-tool, then yours. The crew readiness view: roster
//! and certifications from StationOS joined with payroll standing from
//! StellarLedger — the Rust rendering of `src/features/CrewRoster/CrewRoster.tsx`,
//! reading the same BFF through this MFE's `query` capability.

use std::collections::HashMap;

use serde_json::Value;
use wasm_bindgen::JsValue;
use web_sys::{Document, Element};

use crate::crew::{
    cert_color, child, format_cents, int, list, pay_color, query, text, to_crew_ref,
};

/// The same document `CrewRoster.tsx` sends (and `crew_roster_query.rs` holds).
const ROSTER_QUERY: &str = meridian_crew_services::features::crew_roster_query::DOCUMENT;

const WRAP: &str = "background:#0e1226;color:#dfe4ff;border-radius:12px;padding:20px;font-family:system-ui,sans-serif";
const TH: &str = "text-align:left;color:#5d6690;padding:6px 10px;border-bottom:1px solid #1c2340;text-transform:uppercase;font-size:10px;letter-spacing:1px";
const TD: &str = "padding:8px 10px;border-bottom:1px solid #141a33;font-size:13px";

/// Draw `CrewRoster` into `element`, the slot the shell handed the remote.
pub fn render(element: &Element, _props: &Value) -> Result<(), JsValue> {
    let document = element
        .owner_document()
        .ok_or_else(|| JsValue::from_str("the mount element has no document"))?;

    let card = document.create_element("section")?;
    card.set_attribute("data-capability", "CrewRoster")?;
    card.set_attribute("data-rendered-by", "rust-wasm")?;
    card.set_attribute("style", WRAP)?;
    child(
        &document,
        &card,
        "h3",
        "margin:0 0 4px;font-size:18px",
        Some("🧑‍🚀 Crew Roster"),
    )?;
    child(
        &document,
        &card,
        "p",
        "margin:0 0 16px;color:#5d6690;font-size:12px",
        Some("StationOS roster & certifications · StellarLedger payroll"),
    )?;
    let body = child(&document, &card, "div", "", None)?;
    body.set_attribute("data-state", "loading")?;
    child(
        &document,
        &body,
        "p",
        "color:#5d6690",
        Some("Loading roster…"),
    )?;
    element.append_child(&card)?;

    wasm_bindgen_futures::spawn_local(async move {
        let outcome = query(ROSTER_QUERY).await;
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
    document: &Document,
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
                "color:#c33b4e",
                Some(&format!("Crew roster unavailable: {}", error)),
            )?;
            return Ok(());
        }
    };
    body.set_attribute("data-state", "ready")?;

    let pay_by_ref: HashMap<&str, &Value> = list(&data, "payroll")
        .iter()
        .map(|p| (text(p, "crewRef"), p))
        .collect();
    let certifications = list(&data, "certifications");

    let table = child(
        document,
        body,
        "table",
        "width:100%;border-collapse:collapse",
        None,
    )?;
    let head = child(document, &table, "tr", "", None)?;
    for label in ["Crew", "Section", "Duty", "Certifications", "Last pay"] {
        child(document, &head, "th", TH, Some(label))?;
    }

    for member in list(&data, "crew") {
        let crew_id = int(member, "crewId");
        let row = child(document, &table, "tr", "", None)?;
        row.set_attribute("data-crew-id", &crew_id.to_string())?;

        let name = child(document, &row, "td", TD, None)?;
        child(
            document,
            &name,
            "strong",
            "",
            Some(text(member, "crewMemberName")),
        )?;
        child(document, &row, "td", TD, Some(text(member, "section")))?;
        let duty = text(member, "dutyStatus");
        let duty_color = if duty == "ON_DUTY" {
            "#2e9e6b"
        } else {
            "#8b93b5"
        };
        child(
            document,
            &row,
            "td",
            &format!("{};color:{}", TD, duty_color),
            Some(duty),
        )?;

        let certs = child(document, &row, "td", TD, None)?;
        let held: Vec<&Value> = certifications
            .iter()
            .filter(|c| int(c, "crewId") == crew_id)
            .collect();
        if held.is_empty() {
            child(document, &certs, "span", "color:#5d6690", Some("—"))?;
        }
        for cert in held {
            let color = cert_color(text(cert, "status"));
            child(
                document,
                &certs,
                "span",
                &format!(
                    "display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:700;color:{c};border:1px solid {c};margin-right:4px",
                    c = color
                ),
                Some(text(cert, "certificationCode")),
            )?;
        }

        let pay_cell = child(document, &row, "td", TD, None)?;
        match pay_by_ref.get(to_crew_ref(crew_id).as_str()) {
            Some(pay) => {
                let status = text(pay, "status");
                child(
                    document,
                    &pay_cell,
                    "span",
                    &format!("color:{}", pay_color(status)),
                    Some(&format!(
                        "{} · {}",
                        format_cents(int(pay, "grossCents")),
                        status
                    )),
                )?;
            }
            None => {
                child(
                    document,
                    &pay_cell,
                    "span",
                    "color:#5d6690",
                    Some("no ledger record"),
                )?;
            }
        }
    }
    Ok(())
}
