import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

export async function GET(req) {
  const client = await clientPromise;
  const db = client.db('CUTMSOMPKD');
  const result = await db.collection('som_placements').deleteMany({});
  return NextResponse.json({ message: "Cleared all records", result });
}
