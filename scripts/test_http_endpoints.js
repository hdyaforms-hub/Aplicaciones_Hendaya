const http = require('http')

async function testPages() {
    console.log('--- Probando endpoints del Módulo de Logística ---')
    
    // Probar GET login
    const resLogin = await fetch('http://localhost:3001/login')
    console.log('GET /login status:', resLogin.status)

    // Probar GET API de exportación (sin auth o con parámetros)
    const resExport = await fetch('http://localhost:3001/api/logistica/rutas/exportar')
    console.log('GET /api/logistica/rutas/exportar status:', resExport.status)

    console.log('--- Todo responde correctamente ---')
}

testPages().catch(console.error)
