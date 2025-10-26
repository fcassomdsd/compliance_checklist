import { vi } from 'vitest'

global.window = {
  electronAPI: {
    loadChecklist: vi.fn().mockResolvedValue({
      specialty: 'Test',
      questions: [
        {
          id: 'a01k1231r3yed99tc62614embva',
          topic: 'Automatización',
          sequence: '00010',
          question:
            'Tiene definidos el proveedor del servicio de procesamiento de datos los componentes y el alcance de la red ATN?',
          verification:
            '➢Diagramas lógicos y físicos de red<br>➢ Inventario de componentes de la red ATN',
          reference: 'RAD 10 Volumen 3 10.1 b) 1)',
        },
      ],
    }),
    loadSession: vi.fn().mockResolvedValue({
      summary: {
        specialty: 'VIG',
        location: 'Aeropuerto Internacional de La Isabela',
        lastUpdated: '2025-09-07T19:46:45.098Z',
        finalized: false,
      },
      responses: {
        1: {
          compliance: 'Not applicable',
          id: 'a01k1231r3yed99tc62614embva',
          comments: 'sadfsa;dfasf',
          evidence: ['pendiente.ods'],
        },
        2: {
          evidence: ['annex.csv'],
          id: 'a01k1231r42e1zrhey6jt6n8qws',
          compliance: 'Compliant',
          comments: 'dsfDFADFADSF',
        },
      },
    }),
    saveSession: vi.fn().mockResolvedValue(),
    saveEvidence: vi.fn().mockResolvedValue('/mock/path/file.pdf'),
    setSavePath: vi.fn().mockResolvedValue('/mock/path/Evidence'),
    deleteEvidence: vi.fn().mockResolvedValue(true),
  },
}
