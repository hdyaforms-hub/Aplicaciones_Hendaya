export const SECCIONES = [
    { id: 'patio', nombre: 'PATIO DE SERVICIO', color: 'bg-yellow-400', textColor: 'text-yellow-900', border: 'border-yellow-200' },
    { id: 'bodega', nombre: 'BODEGA', color: 'bg-orange-500', textColor: 'text-white', border: 'border-orange-200' },
    { id: 'cocina', nombre: 'COCINA', color: 'bg-green-600', textColor: 'text-white', border: 'border-green-200' },
    { id: 'bano', nombre: 'BAÑO', color: 'bg-sky-500', textColor: 'text-white', border: 'border-sky-200' },
]

export const PREGUNTAS = [
    // Patio de servicio (Amarillo)
    { id: 'p1', seccion: 'patio', text: '¿Existe Patio de servicio?' },
    { id: 'p2', seccion: 'patio', text: 'a).-¿Cuenta con basurero (concesionario) en el patio de servicio o en el espacio asignado, en buen estado y de tamaño adecuado?' },
    { id: 'p3', seccion: 'patio', text: 'b).-¿La zona que rodea estas áreas se mantienen libres de residuos (ejemplo: escombros, muebles, otros)?' },
    { id: 'p4', seccion: 'patio', text: 'c).-¿Las vías de acceso y zonas de circulación se encuentran pavimentadas?' },
    { id: 'p5', seccion: 'patio', text: 'd).- Cuenta con caseta de Gas en buen estado' },
    { id: 'p6', seccion: 'patio', text: 'e).-Bombona en buen estado' },
    { id: 'p7', seccion: 'patio', text: 'f).-El recinto del servicio de alimentación se encuentra ubicada alejada de focos de insalubridad, olores objetables, humo, contaminantes y no expuestas a inundaciones?' },

    // Bodega (Naranja)
    { id: 'b1', seccion: 'bodega', text: 'a).-¿Cuenta con bodega para almacenamiento de materias primas?' },
    { id: 'b2', seccion: 'bodega', text: 'b).-¿La bodega tiene buenas condiciones de ventilación para un correcto almacenamiento de materias primas?' },
    { id: 'b3', seccion: 'bodega', text: 'c).-¿Los cielos y estructuras elevadas de la bodega se encuentran en buen estado de conservación, de manera de reducir al mínimo la acumulación de suciedad y de condensación, así como el desprendi...' },
    { id: 'b4', seccion: 'bodega', text: 'd).-Puertas, permiten mantener el recinto hermético de tal forma que no exista riesgo de ingreso de plagas?' },
    { id: 'b5', seccion: 'bodega', text: 'e).-¿Las ventanas y otras aberturas se encuentran en buen estado de modo de reducir al mínimo la acumulación de suciedad y son herméticas?' },
    { id: 'b6', seccion: 'bodega', text: 'f).-¿Las ventanas que se abren cuentan con malla mosquitera en buen estado y son herméticas?' },
    { id: 'b7', seccion: 'bodega', text: 'g).-¿Los pisos de la bodega se encuentran en buen estado de conservación, son de material liso, resistente, fácil de drenar, impermeables al líquido y fácil de limpiar?' },
    { id: 'b8', seccion: 'bodega', text: 'h).-¿Las paredes y zócalos de la bodega se encuentran en buen estado de conservación, son se superficie lisa, e impermeables y de fácil limpieza?' },
    { id: 'b9', seccion: 'bodega', text: 'i)¿Las uniones de Pared - Pared y de Pared - Piso permiten la fácil limpieza para evitar la acumulación de suciedad y polvo?' },
    { id: 'b10', seccion: 'bodega', text: 'j)¿Los elementos de iluminación se encuentran en buen estado de funcionamiento (Ampolletas, tubos fluorescentes, halógeno entre otros)?' },
    { id: 'b11', seccion: 'bodega', text: 'k).-¿Los equipos de iluminación suspendidos sobre el material alimentario están protegidos para evitar la contaminación de alimentos en caso de rotura?' },
    { id: 'b12', seccion: 'bodega', text: 'l).-¿La iluminación es adecuada para el proceso de manipulación?' },
    { id: 'b13', seccion: 'bodega', text: 'm).-Botiquín' },
    { id: 'b14', seccion: 'bodega', text: 'n).- Extintores vigentes y en buen estado' },
    { id: 'b15', seccion: 'bodega', text: 'o).-Conexiones eléctricas en buen estado' },

    // Cocina (Verde)
    { id: 'c1', seccion: 'cocina', text: 'a).-¿El tamaño del recinto de cocina permite una operación fluida, higiénica y fácil de controlar?' },
    { id: 'c2', seccion: 'cocina', text: 'b).-¿Existe ventilación adecuada en la cocina para evitar el calor excesivo, la condensación de vapor de agua?' },
    { id: 'c3', seccion: 'cocina', text: 'c).-Puertas, permiten mantener el recinto hermético de tal forma que no exista riesgo de ingreso de plagas?' },
    { id: 'c4', seccion: 'cocina', text: 'd).-¿Las ventanas y otras aberturas se encuentran en buen estado de modo de reducir al mínimo la acumulación de suciedad y son herméticas?' },
    { id: 'c5', seccion: 'cocina', text: 'e).-¿Las ventanas que se abren cuentan con malla mosquitera en buen estado y son herméticas?' },
    { id: 'c6', seccion: 'cocina', text: 'f).-¿Los pisos de la cocina se encuentran en buen estado de conservación, son de material liso, resistente, fácil de drenar, impermeables al líquido y fácil de limpiar?' },
    { id: 'c7', seccion: 'cocina', text: 'g).-¿Las paredes y zócalos de la cocina se encuentran en buen estado de conservación, son se superficie lisa, e impermeables y de fácil limpieza?' },
    { id: 'c8', seccion: 'cocina', text: 'h).-¿Las uniones de Pared - Pared y de Pared - Piso permiten la fácil limpieza para evitar la acumulación de suciedad y polvo?' },
    { id: 'c9', seccion: 'cocina', text: 'i).-¿Los drenajes están construidos y ubicados para fácil limpieza y no representan riesgos de contaminación cruzada?' },
    { id: 'c10', seccion: 'cocina', text: 'j).-¿La inclinación de los pisos guian los líquidos a los desagües y estos tienen pendiente adecuada para permitir la eliminación efectiva de toda las aguas residuales y eviten desbordamiento o al...' },
    { id: 'c11', seccion: 'cocina', text: 'k).-¿Los cielos y estructuras elevadas de la cocina se encuentran en buen estado de conservación, de manera de reducir al mínimo la acumulación de suciedad y de condensación, así como el desprendi...' },
    { id: 'c12', seccion: 'cocina', text: 'l).-Lava Fondos, cantidad requerida y en buen estado' },
    { id: 'c13', seccion: 'cocina', text: 'm).-¿Cuenta con lavamanos con agua fría en zona de manipulación y este se encuentra en buen estado? RSA Art. 33' },
    { id: 'c14', seccion: 'cocina', text: 'n).-Si hay lavamanos, ¿éste cuenta con dispensador de jabón y toalla de papel?' },
    { id: 'c15', seccion: 'cocina', text: 'o).-Calefon' },
    { id: 'c16', seccion: 'cocina', text: 'p).-Pre Wash' },
    { id: 'c17', seccion: 'cocina', text: 'q).-Extractor para la campana y sombrero?' },
    { id: 'c18', seccion: 'cocina', text: 'r).-Carros porta Bandejas (Enseñanza media cuando aplique)' },
    { id: 'c19', seccion: 'cocina', text: 's).-¿Los elementos de iluminación se encuentran en buen estado de funcionamiento (Ampolletas, tubos fluorescentes, halógeno entre otros)?' },
    { id: 'c20', seccion: 'cocina', text: 't).-Los equipos de iluminación suspendidos sobre el material alimentario están protegidos para evitar la contaminación de alimentos en caso de rotura?' },
    { id: 'c21', seccion: 'cocina', text: 'u).-¿La iluminación es adecuada para el proceso de manipulación?' },
    { id: 'c22', seccion: 'cocina', text: 'v).-Basureros con tapa' },
    { id: 'c23', seccion: 'cocina', text: 'w).-Llaves y sifón en buen estado (Sin fuga de agua)' },
    { id: 'c24', seccion: 'cocina', text: 'x).-Cañerías de agua en buen estado' },
    { id: 'c25', seccion: 'cocina', text: 'y).-Cañerías de Gas en buen estado' },
    { id: 'c26', seccion: 'cocina', text: 'z).-Conexiones eléctricas en buen estado' },
    { id: 'c27', seccion: 'cocina', text: 'aa).- Los sistemas de trampas de residuos (por ejemplo, trampas de grasa) deberán contenerse para evitar la contaminación cruzada o se ubicarán lejos de cualquier zona de manipulación de alimentos.' },

    // Baño (Celeste)
    { id: 'ba1', seccion: 'bano', text: 'a).-¿Existe baño y vestidor exclusivo para el personal manipulador?' },
    { id: 'ba2', seccion: 'bano', text: 'b).-¿Los vestuarios y/o servicios higiénicos del personal manipulador se encuentran sin conexión directa a la zona de preparación de alimentos?' },
    { id: 'ba3', seccion: 'bano', text: 'c).-Puertas, permiten mantener el recinto hermético de tal forma que no exista riesgo de ingreso de plagas?' },
    { id: 'ba4', seccion: 'bano', text: 'd).-¿Las ventanas que se abren cuentan con malla mosquitera en buen estado y son hermética?' },
    { id: 'ba5', seccion: 'bano', text: 'e).-¿Los pisos del baño se encuentran en buen estado de conservación, son de material liso, resistente, fácil de drenar, impermeables al líquido y fácil de limpiar?' },
    { id: 'ba6', seccion: 'bano', text: 'f).-¿Las paredes y zócalos del baño se encuentran en buen estado de conservación, son se superficie lisa, e impermeables y de fácil limpieza?' },
    { id: 'ba7', seccion: 'bano', text: 'g).-¿Lava Manos con agua caliente y fría?' },
    { id: 'ba8', seccion: 'bano', text: 'h).-Ducha' },
    { id: 'ba9', seccion: 'bano', text: 'i).-Cortina' },
    { id: 'ba10', seccion: 'bano', text: 'j).-¿Dispensadores de Jabón?' },
    { id: 'ba11', seccion: 'bano', text: 'k).-Estanque y Tapa WC en buen estado' },
    { id: 'ba12', seccion: 'bano', text: 'l).-En caso de contar con espejo, está en buen estado (no es requisito)' },
    { id: 'ba13', seccion: 'bano', text: 'm).-Basurero con tapa' },
    { id: 'ba14', seccion: 'bano', text: 'n).-Llaves y sifón en buen estado (Sin fuga de agua)' },
    { id: 'ba15', seccion: 'bano', text: 'o).-¿Existe dispensador de papel higiénico y toalla de papel?' },
    { id: 'ba16', seccion: 'bano', text: 'p).- La iluminaria esta en buen estado?' },
]

export const GRAVEDAD_OPCIONES = [
    { value: 1, label: '1 - Bajo' },
    { value: 2, label: '2 - Medio' },
    { value: 3, label: '3 - Alto' },
]

export const PROBABILIDAD_OPCIONES = [
    { value: 1, label: '1 - Bajo' },
    { value: 2, label: '2 - Medio' },
    { value: 3, label: '3 - Alto' },
]

export const RIESGO_OPCIONES = [
    { value: 'Bajo riesgo: Resolver (eliminar o mitigar) en menos de 90 días', label: 'Bajo riesgo (90 días)', color: 'bg-green-100 text-green-700 font-bold' },
    { value: 'Medio riesgo: Resolver (eliminar o mitigar) en menos de 60 días', label: 'Medio riesgo (60 días)', color: 'bg-yellow-100 text-yellow-700 font-bold' },
    { value: 'Alto riesgo: Resolver (eliminar o mitigar) en menos de 30 días', label: 'Alto riesgo (30 días)', color: 'bg-red-100 text-red-700 font-bold' },
]
