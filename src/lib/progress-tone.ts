/** Cor da barra de progresso conforme o estágio. */
export function progressTone(percent: number): string {
  if (percent >= 100) return "[&>div]:bg-success";
  return "[&>div]:bg-brand";
}
