import multer from "multer";

const storage = multer.memoryStorage();

// Single file upload (for guide documents)
const upload = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // Only allow 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    console.log("🔍 File filter check:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf"
    ];

    if (!allowed.includes(file.mimetype)) {
      console.error("❌ File type not allowed:", file.mimetype);
      return cb(
        new Error(`Invalid file type '${file.mimetype}'. Allowed: JPEG, PNG, PDF`), 
        false
      );
    }
    
    console.log("✅ File type accepted");
    cb(null, true);
  }
});

// Multiple image upload (for reviews)
export const uploadReviewImages = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // Maximum 5 images
  },
  fileFilter: (req, file, cb) => {
    console.log("🔍 Review image filter check:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    const allowedImages = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];

    if (!allowedImages.includes(file.mimetype)) {
      console.error("❌ Invalid image type:", file.mimetype);
      return cb(
        new Error(`Invalid file type. Allowed: JPEG, PNG, WebP`), 
        false
      );
    }
    
    console.log("✅ Image type accepted");
    cb(null, true);
  }
});

console.log("✅ Upload middleware configured");

export default upload;
