import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat or lng" }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ address: `${lat}, ${lng}`, ward: "Unknown Ward" });
  }

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
    const data = await res.json();

    if (data.status !== "OK" || !data.results.length) {
      return NextResponse.json({ address: `${lat}, ${lng}`, ward: "Unknown Ward" });
    }

    const result = data.results[0];
    const address = result.formatted_address;
    const comps = result.address_components || [];
    
    const neighborhood = comps.find((c: any) => c.types.includes("neighborhood") || c.types.includes("sublocality"))?.long_name || "";
    const city = comps.find((c: any) => c.types.includes("locality") || c.types.includes("administrative_area_level_2"))?.long_name || "";

    return NextResponse.json({ address, neighborhood, city });
  } catch (err) {
    console.error("[geocode API] Error:", err);
    return NextResponse.json({ address: `${lat}, ${lng}`, neighborhood: "", city: "" });
  }
}
