// Carga las variables del archivo .env antes de configurar el servidor.
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = Number(process.env.PORT) || 3000;

// El pool administra y reutiliza conexiones con MySQL.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Convierte errores de rutas asincrónicas en errores del middleware de Express.
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// Solo se aceptan identificadores enteros positivos.
function getValidId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Comprueba los campos editables y limita su longitud según la tabla.
function getValidUser(body) {
  const fields = ['usu_usuario', 'usu_nombre', 'usu_apellido'];
  const user = {};

  for (const field of fields) {
    if (typeof body[field] !== 'string' || body[field].trim().length > 50) {
      return null;
    }
    user[field] = body[field].trim();
  }

  if (!user.usu_usuario || !user.usu_nombre || !user.usu_apellido) {
    return null;
  }

  return user;
}

// GET /api/usuarios?q=texto devuelve todos los usuarios o filtra por nombre/usuario.
app.get('/api/usuarios', asyncHandler(async (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  let query = 'SELECT usu_id, usu_usuario, usu_nombre, usu_apellido FROM usuarios';
  const values = [];

  if (search) {
    query += ' WHERE usu_nombre LIKE ? OR usu_usuario LIKE ?';
    values.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY usu_id';
  const [users] = await pool.execute(query, values);
  res.json(users);
}));

// POST /api/usuarios crea un usuario sin permitir que el cliente asigne el ID.
app.post('/api/usuarios', asyncHandler(async (req, res) => {
  const user = getValidUser(req.body);
  if (!user) {
    return res.status(400).json({ error: 'Completa los tres campos con un máximo de 50 caracteres.' });
  }

  const [result] = await pool.execute(
    'INSERT INTO usuarios (usu_usuario, usu_nombre, usu_apellido) VALUES (?, ?, ?)',
    [user.usu_usuario, user.usu_nombre, user.usu_apellido]
  );

  res.status(201).json({ usu_id: result.insertId, ...user });
}));

// PUT /api/usuarios/:id reemplaza los campos editables del usuario indicado.
app.put('/api/usuarios/:id', asyncHandler(async (req, res) => {
  const id = getValidId(req.params.id);
  const user = getValidUser(req.body);
  if (!id) {
    return res.status(400).json({ error: 'El identificador no es válido.' });
  }
  if (!user) {
    return res.status(400).json({ error: 'Completa los tres campos con un máximo de 50 caracteres.' });
  }

  const [result] = await pool.execute(
    'UPDATE usuarios SET usu_usuario = ?, usu_nombre = ?, usu_apellido = ? WHERE usu_id = ?',
    [user.usu_usuario, user.usu_nombre, user.usu_apellido, id]
  );

  // MySQL puede informar cero cambios si los datos enviados ya eran iguales.
  if (result.affectedRows === 0) {
    const [existing] = await pool.execute('SELECT usu_id FROM usuarios WHERE usu_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'No se encontró el usuario.' });
    }
  }

  res.json({ usu_id: id, ...user });
}));

// DELETE /api/usuarios/:id elimina únicamente el usuario indicado.
app.delete('/api/usuarios/:id', asyncHandler(async (req, res) => {
  const id = getValidId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'El identificador no es válido.' });
  }

  const [result] = await pool.execute('DELETE FROM usuarios WHERE usu_id = ?', [id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'No se encontró el usuario.' });
  }

  res.json({ message: 'Usuario eliminado correctamente.' });
}));

// Devuelve errores legibles sin exponer detalles internos de la base de datos.
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  res.status(500).json({ error: 'Ocurrió un error en el servidor. Revisa la conexión con MySQL.' });
});

app.listen(port, () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
});