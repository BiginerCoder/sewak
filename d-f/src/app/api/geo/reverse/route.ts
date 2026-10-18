import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "Missing lat or lon parameters." }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("addressdetails", "1");

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        "User-Agent": "SewakCivicApp/1.0 (civic.local; contact@sewak.local)",
        "Accept-Language": "en, hi",
      },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Geocoding upstream returned status ${upstream.status}` }, { status: 502 });
    }

    const data = await upstream.json();
    const address = data.address || {};

    const postcode = address.postcode || "";
    const road = address.road || address.pedestrian || address.street || address.residential || "";
    const neighbourhood = address.neighbourhood || address.suburb || address.quarter || address.residential || address.city_district || "";
    const city = address.city || address.town || address.village || address.municipality || address.county || "";
    const state = address.state || "";

    // Generate concise human-friendly location name
    const parts = [road, neighbourhood, city].filter(Boolean);
    const shortName = parts.length > 0 ? parts.slice(0, 2).join(", ") : data.display_name?.split(",")[0] || "Detected Location";
    const displayName = postcode ? `${shortName} (${postcode})` : shortName;

    return NextResponse.json({
      ok: true,
      data: {
        raw: data,
        address,
        displayName,
        formattedAddress: data.display_name || "",
        road,
        neighbourhood,
        city,
        state,
        postcode,
        lat: Number(data.lat || lat),
        lon: Number(data.lon || lon),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reverse geocode location." },
      { status: 500 }
    );
  }
}
