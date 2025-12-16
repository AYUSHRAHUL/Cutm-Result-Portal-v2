import { clientPromise } from "@/lib/mongodb";
import bcrypt from "bcryptjs";

function normalizeRole(input) {
  const raw = String(input || "user").trim().toLowerCase();
  if (["admin", "administrator", "adm", "admn", "adim"].includes(raw)) return "admin";
  if (["teacher", "faculty", "prof", "instructor"].includes(raw)) return "teacher";
  if (["user", "student"].includes(raw)) return "user";
  return "user";
}

export async function POST(req) {
  try {
    // Parse the body from the request
    const { name, email, password, confirmPassword, role, employeeId } = await req.json();

    // Basic validation
    if (!name || !email || !password) {
      return Response.json(
        { success: false, error: "All fields are required." },
        { status: 400 }
      );
    }

    // Password confirmation validation
    if (password !== confirmPassword) {
      return Response.json(
        { success: false, error: "Passwords do not match." },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password.length < 6) {
      return Response.json(
        { success: false, error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // Email domain validation
    const allowedDomains = ['@cutm.ac.in', '@centurionuniv.edu.in'];
    const emailDomain = email.substring(email.lastIndexOf('@'));
    
    if (!allowedDomains.includes(emailDomain)) {
      return Response.json(
        { success: false, error: "Only @cutm.ac.in or @centurionuniv.edu.in email addresses are allowed." },
        { status: 400 }
      );
    }

    // Validate employee ID for teachers
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === "teacher" && !employeeId) {
      return Response.json(
        { success: false, error: "Employee ID is required for teachers." },
        { status: 400 }
      );
    }

    // Connect to MongoDB (uses USER DB for authentication)
    const client = await clientPromise;
    const db = client.db("USER");

    // Check if the email already exists
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return Response.json(
        { success: false, error: "Email already registered." },
        { status: 400 }
      );
    }

    // Check if employee ID already exists for teachers
    if (normalizedRole === "teacher" && employeeId) {
      const existingEmployee = await db.collection("users").findOne({ employeeId });
      if (existingEmployee) {
        return Response.json(
          { success: false, error: "Employee ID already registered." },
          { status: 400 }
        );
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user (normalize role)
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: normalizedRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add employee ID for teachers
    if (normalizedRole === "teacher" && employeeId) {
      userData.employeeId = employeeId;
    }

    const insertRes = await db.collection("users").insertOne(userData);
    const newUser = { _id: insertRes.insertedId, name, email, role: normalizedRole, employeeId: userData.employeeId };

    // Response
    return Response.json(
      {
        success: true,
        message: "Registration successful!",
        user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, employeeId: newUser.employeeId },
      },
      { status: 201 }
    );
  } catch (err) {
    return Response.json(
      { success: false, error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
