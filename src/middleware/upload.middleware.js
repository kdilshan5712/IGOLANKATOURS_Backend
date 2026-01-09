import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "application/pdf"
    ];

    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Invalid file type"), false);
    } else {
      cb(null, true);
    }
  }
});

export default upload;
