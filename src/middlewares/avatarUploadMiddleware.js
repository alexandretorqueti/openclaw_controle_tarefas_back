// src/middlewares/avatarUploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar armazenamento temporário
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = '/tmp/avatar-uploads';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Nome temporário
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `temp-${uniqueSuffix}${ext}`);
  }
});

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos de imagem são permitidos (jpeg, jpg, png, gif, webp)'), false);
  }
};

// Configurar multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: fileFilter
});

// Middleware para upload único
const uploadAvatar = upload.single('avatar');

// Wrapper com tratamento de erros
const handleAvatarUpload = (req, res, next) => {
  uploadAvatar(req, res, function (err) {
    if (err) {
      // Limpar arquivo temporário se existir
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, () => {});
      }
      
      // Tratar erros do multer
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'Arquivo muito grande. Tamanho máximo: 5MB'
          });
        }
        return res.status(400).json({
          success: false,
          error: `Erro no upload: ${err.message}`
        });
      } else if (err) {
        // Erro do filtro de arquivo
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
    }
    
    // Arquivo carregado com sucesso
    next();
  });
};

module.exports = handleAvatarUpload;