export function formatReal(value: string): string {
  const numbers = value.replace(/\D/g, '')
  if (!numbers) return ''

  const numberValue = (Number(numbers) / 100).toFixed(2)
  const [integer, decimal] = numberValue.split('.')

  const withThousands = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `R$ ${withThousands},${decimal}`
}
