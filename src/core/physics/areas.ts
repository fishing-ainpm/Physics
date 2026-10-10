export type AreaId = 'mecanica' | 'relatividade' | 'quantica' | 'cosmologia' | 'termodinamica' | 'eletromagnetismo' | 'outra';

export const AREAS: { id: AreaId; name: string }[] = [
  { id: 'mecanica', name: 'Mecânica clássica' },
  { id: 'relatividade', name: 'Relatividade' },
  { id: 'quantica', name: 'Mecânica quântica' },
  { id: 'cosmologia', name: 'Cosmologia' },
  { id: 'termodinamica', name: 'Termodinâmica' },
  { id: 'eletromagnetismo', name: 'Eletromagnetismo' },
  { id: 'outra', name: 'Outra / geral' },
];

export function areaName(id: string): string {
  return AREAS.find((a) => a.id === id)?.name ?? id;
}
