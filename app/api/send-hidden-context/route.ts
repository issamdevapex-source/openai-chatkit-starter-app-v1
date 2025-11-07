import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const hidden_user_data = {
      property_type: body.property_type,
      developer_full_name: body.developer_full_name,
      location: body.location,
      final_investment_verdict: body.final_investment_verdict,
      price: body.price,
      currency: body.currency,
      surface_area_sqft: body.surface_area_sqft,
      price_per_sqft: body.price_per_sqft,
      overall_investment_score: body.overall_investment_score,
      market_demand_rate: body.market_demand_rate,
      market_supply_rate: body.market_supply_rate,
      liquidity_score: body.liquidity_score,
      liquidity_period_month: body.liquidity_period_month,
      location_score: body.location_score,
      roi_rental_yield_score: body.roi_rental_yield_score,
      price_accuracy_score: body.price_accuracy_score,
      demand_vacancy_risk_score: body.demand_vacancy_risk_score,
      developer_trust_index: body.developer_trust_index,
      physical_condition_score: body.physical_condition_score,
      legal_clarity_score: body.legal_clarity_score,
      completion_status: body.completion_status,
      handover_quarter: body.handover_quarter,
      opportunities_summary: body.opportunities_summary,
      risks_summary: body.risks_summary,
    };

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "verse",
        metadata: {
          source: "KELL-RealEstate",
          user_context_type: "property_analysis",
          hidden_user_data,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erreur API OpenAI:", errText);
      return NextResponse.json(
        { error: "Erreur lors de la création de la session" },
        { status: response.status }
      );
    }

    const sessionData = await response.json();
    return NextResponse.json(sessionData);
  } catch (error) {
    console.error("Erreur création session :", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Erreur lors de la création de la session" },
      { status: 500 }
    );
  }
}
