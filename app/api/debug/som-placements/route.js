import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

export async function GET(req) {
  const client = await clientPromise;
  const db = client.db('CUTMSOMPKD');
  const data = await db.collection('som_placements').find({}).toArray();
  return NextResponse.json(data);
}
