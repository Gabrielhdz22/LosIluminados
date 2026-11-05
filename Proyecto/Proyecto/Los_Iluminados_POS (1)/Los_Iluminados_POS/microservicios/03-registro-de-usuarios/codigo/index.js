const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(express.json()); // Permite recibir JSON en las peticiones
app.use(cors()); // Permite que otros servicios se comuniquen con este

// Base de datos simulada (Aquí conectarías tu PostgreSQL, MySQL o MongoDB)
const usersDB = []; 

// Endpoint principal para el Servicio 1: Registro de Usuarios
app.post('/api/v1/usuarios/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        // 1. Validación básica
        if (!nombre || !email || !password) {
            return res.status(400).json({
                exito: false,
                mensaje: "Faltan campos obligatorios (nombre, email, password)."
            });
        }

        // 2. Verificar si el usuario ya existe
        const usuarioExistente = usersDB.find(u => u.email === email);
        if (usuarioExistente) {
            return res.status(409).json({
                exito: false,
                mensaje: "El correo electrónico ya está registrado."
            });
        }

        // 3. Encriptar la contraseña (Regla de oro en seguridad)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Crear el nuevo usuario
        const nuevoUsuario = {
            id: usersDB.length + 1, // ID autogenerado
            nombre,
            email,
            password: hashedPassword,
            fechaRegistro: new Date().toISOString()
        };

        // 5. Guardar en base de datos
        usersDB.push(nuevoUsuario);

        // 6. Respuesta exitosa (Sin devolver la contraseña)
        return res.status(201).json({
            exito: true,
            mensaje: "Usuario registrado correctamente.",
            datos: {
                id: nuevoUsuario.id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email,
                fechaRegistro: nuevoUsuario.fechaRegistro
            }
        });

    } catch (error) {
        console.error("Error en el registro:", error);
        return res.status(500).json({
            exito: false,
            mensaje: "Error interno del servidor."
        });
    }
});

// Levantar el microservicio
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servicio de Registro ejecutándose en http://localhost:${PORT}`);
});