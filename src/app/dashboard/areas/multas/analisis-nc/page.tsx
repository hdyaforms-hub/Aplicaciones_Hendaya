import { Metadata } from 'next'
import AnalisisNCClient from './AnalisisNCClient'

export const metadata: Metadata = {
    title: 'Análisis de NC (C5) | Hendaya',
    description: 'Motor de auditoría de reglas normativas, vicios procedimentales y descargos de actas'
}

export default function AnalisisNCPage() {
    return <AnalisisNCClient />
}
