// backend/middleware/validation.js
export const validateLogData = (req, res, next) => {
  const { plant_name, date, height, nutrients } = req.body;
  const errors = [];

  // Validate plant name
  if (!plant_name || typeof plant_name !== 'string' || plant_name.trim().length === 0) {
    errors.push('Plant name is required and must be a non-empty string');
  } else if (plant_name.length > 100) {
    errors.push('Plant name must be less than 100 characters');
  }

  // Validate date
  if (!date) {
    errors.push('Date is required');
  } else if (isNaN(Date.parse(date))) {
    errors.push('Date must be a valid date format');
  }

  // Validate height
  if (height === undefined || height === null || height === '') {
    errors.push('Height is required');
  } else {
    const heightNum = parseFloat(height);
    if (isNaN(heightNum) || heightNum < 0 || heightNum > 1000) {
      errors.push('Height must be a number between 0 and 1000 cm');
    }
  }

  // Validate nutrients
  if (!nutrients || typeof nutrients !== 'string' || nutrients.trim().length === 0) {
    errors.push('Nutrients information is required');
  } else if (nutrients.length > 500) {
    errors.push('Nutrients description must be less than 500 characters');
  }

  // Validate notes (optional)
  if (req.body.notes && req.body.notes.length > 1000) {
    errors.push('Notes must be less than 1000 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors 
    });
  }

  next();
};

export const validateFileUpload = (req, res, next) => {
  if (req.file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only JPEG, PNG, and GIF images are allowed.' 
      });
    }

    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 5MB.' 
      });
    }
  }

  next();
};
