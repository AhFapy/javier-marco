const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Use CORS middleware
app.use(cors());

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'database.db');
let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to SQLite database.');

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      email TEXT UNIQUE,
      pass TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating usuarios table:', err.message);
      } else {
        console.log('Created usuarios table.');
      }
    });

    // Create the proyectos table
    db.run(`CREATE TABLE IF NOT EXISTS proyectos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_proyecto TEXT,
      usuario_instagram TEXT,
      tickets TEXT,
      tarifa_setter REAL,
      objetivo_ventas REAL,
      facturacion_estimada REAL,
      usuarios TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating proyectos table:', err.message);
      } else {
        console.log('Created proyectos table.');
      }
    });
  }
});

// Ruta para obtener usuarios
app.get('/usuarios', (req, res) => {
  db.all(`SELECT * FROM usuarios`, [], (err, rows) => {
    if (err) {
      console.error('Error fetching usuarios:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ usuarios: rows });
  });
});

// Ruta para obtener proyectos
app.get('/proyectos', (req, res) => {
  db.all(`SELECT * FROM proyectos`, [], (err, rows) => {
    if (err) {
      console.error('Error fetching proyectos:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ proyectos: rows });
  });
});

// Ruta para obtener un proyecto por ID
app.get('/proyectos/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT * FROM proyectos WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error('Error fetching project:', err.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ proyecto: row });
  });
});


// Ruta para actualizar la facturación estimada de un proyecto por ID
app.put('/proyectos/update/:id', (req, res) => {
  const { facturacion_estimada } = req.body;
  const id = req.params.id;

  db.run(`UPDATE proyectos SET facturacion_estimada = ? WHERE id = ?`, [facturacion_estimada, id], function(err) {
    if (err) {
      console.error('Error updating project:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ changes: this.changes });
  });
});


// Ruta para obtener proyectos de un usuario específico
app.get('/proyectos/user/:userId', (req, res) => {
  const userId = req.params.userId;
  db.all(`SELECT * FROM proyectos WHERE usuarios LIKE ?`, [`%${userId}%`], (err, rows) => {
    if (err) {
      console.error('Error fetching user projects:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ proyectos: rows });
  });
});

// Ruta para crear un nuevo usuario
app.post('/create', (req, res) => {
  const { nombre, email, pass } = req.body;

  db.run(`INSERT INTO usuarios (nombre, email, pass) VALUES (?, ?, ?)`, [nombre, email, pass], function(err) {
    if (err) {
      console.error('Error inserting user:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ id: this.lastID, nombre, email });
  });
});

// Ruta para login
app.post('/login', (req, res) => {
  const { email, pass } = req.body;

  db.get(`SELECT * FROM usuarios WHERE email = ? AND pass = ?`, [email, pass], (err, row) => {
    if (err) {
      console.error('Error querying user:', err.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (row) {
      return res.status(200).json({ message: 'Login successful', user: row });
    } else {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
  });
});

// Ruta para crear un nuevo proyecto
app.post('/proyectos', (req, res) => {
  const { nombre_proyecto, usuario_instagram, tickets, tarifa_setter, objetivo_ventas, facturacion_estimada, usuarios } = req.body;

  db.run(`INSERT INTO proyectos (nombre_proyecto, usuario_instagram, tickets, tarifa_setter, objetivo_ventas, facturacion_estimada, usuarios) VALUES (?, ?, ?, ?, ?, ?, ?)`, [nombre_proyecto, usuario_instagram, tickets, tarifa_setter, objetivo_ventas, facturacion_estimada, usuarios], function(err) {
    if (err) {
      console.error('Error inserting proyecto:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ id: this.lastID, nombre_proyecto, usuario_instagram, tickets, tarifa_setter, objetivo_ventas, facturacion_estimada, usuarios });
  });
});

// Ruta para añadir un usuario a un proyecto
app.post('/proyectos/addUser', (req, res) => {
  const { projectId, email } = req.body;

  db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], (err, user) => {
    if (err) {
      console.error('Error querying user:', err.message);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.get(`SELECT * FROM proyectos WHERE id = ?`, [projectId], (err, project) => {
      if (err) {
        console.error('Error querying project:', err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const updatedUsers = project.usuarios ? `${project.usuarios},${user.id}` : `${user.id}`;

      db.run(`UPDATE proyectos SET usuarios = ? WHERE id = ?`, [updatedUsers, projectId], function(err) {
        if (err) {
          console.error('Error updating project:', err.message);
          return res.status(400).json({ error: err.message });
        }
        res.json({ message: 'User added to project successfully' });
      });
    });
  });
});

// Ruta para actualizar un proyecto por ID
app.put('/proyectos/:id', (req, res) => {
  const { nombre_proyecto, usuario_instagram, tickets, tarifa_setter, objetivo_ventas, facturacion_estimada, usuarios } = req.body;
  const id = req.params.id;

  db.run(`UPDATE proyectos SET nombre_proyecto = ?, usuario_instagram = ?, tickets = ?, tarifa_setter = ?, objetivo_ventas = ?, facturacion_estimada = ?, usuarios = ? WHERE id = ?`, [nombre_proyecto, usuario_instagram, tickets, tarifa_setter, objetivo_ventas, facturacion_estimada, usuarios, id], function(err) {
    if (err) {
      console.error('Error updating proyecto:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ changes: this.changes });
  });
});

// Ruta para eliminar un proyecto por ID
app.delete('/proyectos/:id', (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM proyectos WHERE id = ?`, id, function(err) {
    if (err) {
      console.error('Error deleting proyecto:', err.message);
      return res.status(400).json({ error: err.message });
    }
    res.json({ changes: this.changes });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Close the database connection when the server stops
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
    process.exit(0);
  });
});
