import jwt from "jsonwebtoken";

// Safety check for JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is not defined");
  process.exit(1);
}

export const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
