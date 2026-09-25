//! Crew-domain glue — the Rust rendering of the web lane's
//! `src/features/shared/crew.ts`, shared by this crate's hosts and the
//! browser build's renderers.
//!
//! StationOS knows crew as integer `CrewId 42`; StellarLedger pays them as
//! `crewRef "CRW-0042"`.

/// `CrewId 42` → `"CRW-0042"`.
pub fn to_crew_ref(crew_id: i64) -> String {
    format!("CRW-{:04}", crew_id)
}

/// Cents → `₢ 7,200.00`, as `formatCents` renders it with `en-US` grouping.
pub fn format_cents(cents: i64) -> String {
    let sign = if cents < 0 { "-" } else { "" };
    let cents = cents.unsigned_abs();
    let whole = (cents / 100).to_string();
    let mut grouped = String::new();
    for (i, digit) in whole.chars().enumerate() {
        if i > 0 && (whole.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(digit);
    }
    format!("₢ {}{}.{:02}", sign, grouped, cents % 100)
}

pub fn cert_color(status: &str) -> &'static str {
    match status {
        "EXPIRED" => "#c33b4e",
        "EXPIRING" => "#d9a514",
        _ => "#2e9e6b",
    }
}

pub fn pay_color(status: &str) -> &'static str {
    match status {
        "HELD" => "#c33b4e",
        "SCHEDULED" => "#d9a514",
        _ => "#2e9e6b",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crew_ref_pads_to_four_digits() {
        assert_eq!(to_crew_ref(42), "CRW-0042");
        assert_eq!(to_crew_ref(12345), "CRW-12345");
    }

    #[test]
    fn cents_format_as_the_web_lane_does() {
        assert_eq!(format_cents(720_000), "₢ 7,200.00");
        assert_eq!(format_cents(1_130_000), "₢ 11,300.00");
        assert_eq!(format_cents(5), "₢ 0.05");
        assert_eq!(format_cents(123_456_789), "₢ 1,234,567.89");
    }

    #[test]
    fn status_colors_match_the_web_lane() {
        assert_eq!(pay_color("HELD"), "#c33b4e");
        assert_eq!(pay_color("SCHEDULED"), "#d9a514");
        assert_eq!(pay_color("PAID"), "#2e9e6b");
        assert_eq!(cert_color("EXPIRING"), "#d9a514");
    }
}
