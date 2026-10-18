import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const isPincode = /^\d{6}$/.test(q);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "in");
  url.searchParams.set("limit", "8");

  if (isPincode) {
    url.searchParams.set("postalcode", q);
  } else {
    url.searchParams.set("q", q);
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        "User-Agent": "SewakCivicApp/1.0 (civic.local; contact@sewak.local)",
        "Accept-Language": "en, hi",
      },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Search upstream returned status ${upstream.status}` }, { status: 502 });
    }

    const items = await upstream.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ ok: true, results: [] });
    }

    const results = items.map((item) => {
      const address = item.address || {};
      const postcode = address.postcode || (isPincode ? q : "");
      const road = address.road || address.pedestrian || address.street || address.residential || "";
      const neighbourhood = address.neighbourhood || address.suburb || address.quarter || address.residential || address.city_district || "";
      const city = address.city || address.town || address.village || address.municipality || address.county || "";
      const state = address.state || "";

      const primary = [road, neighbourhood].filter(Boolean).join(", ") || item.name || neighbourhood || city || "Area";
      const secondary = [city, state, postcode].filter(Boolean).join(", ");
      const displayName = postcode ? `${primary} (${postcode})` : primary;

      return {
        id: postcode ? `pin-${postcode}` : `geo-${item.place_id || item.osm_id}`,
        displayName,
        primaryText: primary,
        secondaryText: secondary,
        formattedAddress: item.display_name || "",
        postcode,
        road,
        neighbourhood,
        city,
        state,
        lat: Number(item.lat),
        lon: Number(item.lon),
      };
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search location." },
      { status: 500 }
    );
  }
}
