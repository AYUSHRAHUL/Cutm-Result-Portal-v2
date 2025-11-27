import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { jwtVerify } from "jose";
import { ObjectId } from "mongodb";

// JWT verification helper
async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can view registration data" 
      }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");
    const collection = db.collection("RegistrationData");

    // Get all registration data
    const data = await collection.find({ Type: 'Registration' }).toArray();
    
    // Calculate statistics
    const stats = {
      totalRecords: data.length,
      uniqueStudents: new Set(data.map(item => item.Reg_No)).size,
      semesters: [...new Set(data.map(item => item.Sem))].sort(),
      departments: [...new Set(data.map(item => {
        if (item.Reg_No && item.Reg_No.length >= 8) {
          const deptCode = item.Reg_No.charAt(7);
          const deptMap = {
            '1': 'Civil Engineering',
            '2': 'Computer Science',
            '3': 'Electronics & Communication',
            '5': 'Electrical & Electronics',
            '6': 'Mechanical Engineering'
          };
          return deptMap[deptCode] || 'Unknown';
        }
        return 'Unknown';
      }))].sort()
    };

    return NextResponse.json({
      success: true,
      data,
      stats
    });

  } catch (error) {
    console.error('Registration data fetch error:', error);
    return NextResponse.json({ 
      error: `Failed to fetch registration data: ${error.message}` 
    }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can edit registration data" 
      }, { status: 403 });
    }

    const body = await req.json();
    const { recordId, updates } = body;

    if (!recordId || !updates) {
      return NextResponse.json({ error: "Missing recordId or updates" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");
    const collection = db.collection("RegistrationData");

    // Convert recordId to ObjectId
    let recordObjectId;
    try {
      recordObjectId = new ObjectId(recordId);
    } catch (error) {
      return NextResponse.json({ error: "Invalid record ID format" }, { status: 400 });
    }

    // Update the record
    const result = await collection.findOneAndUpdate(
      { _id: recordObjectId, Type: 'Registration' },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Record updated successfully",
      data: result.value
    });

  } catch (error) {
    console.error('Registration data update error:', error);
    return NextResponse.json({ 
      error: `Failed to update registration data: ${error.message}` 
    }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    // Check authentication
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized - Please login first" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.email) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = payload.role?.toLowerCase();
    if (userRole !== 'admin') {
      return NextResponse.json({ 
        error: "Access denied - Only admins can delete registration data" 
      }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db("cutm1");
    const collection = db.collection("RegistrationData");

    // Check if specific record IDs are provided
    const url = new URL(req.url);
    const recordIds = url.searchParams.get('ids');
    
    if (recordIds) {
      // Delete specific records
      const ids = recordIds.split(',').map(id => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      }).filter(id => id !== null);

      if (ids.length === 0) {
        return NextResponse.json({ error: "Invalid record IDs" }, { status: 400 });
      }

      const result = await collection.deleteMany({ 
        _id: { $in: ids },
        Type: 'Registration' 
      });

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} registration record(s)`,
        deletedCount: result.deletedCount
      });
    } else {
      // Delete all registration data (existing behavior)
      const result = await collection.deleteMany({ Type: 'Registration' });

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} registration records`,
        deletedCount: result.deletedCount
      });
    }

  } catch (error) {
    console.error('Registration data delete error:', error);
    return NextResponse.json({ 
      error: `Failed to delete registration data: ${error.message}` 
    }, { status: 500 });
  }
}
