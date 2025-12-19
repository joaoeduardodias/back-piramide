import { formatReal } from '@/utils/format-real';

export function orderCreatedTemplate(order: {
  number: number;
  items: {
    quantity: number;
    unitPrice: number;
  }[];
}) {
  const total = order.items.reduce((acc, item) => {
    return acc + item.unitPrice * item.quantity
  }, 0)

  return `
    <h1>Pedido confirmado 🎉</h1>
    <p>Seu pedido <strong>#${order.number}</strong> foi criado com sucesso.</p>
    <p>Total: <strong>${formatReal(String(total))}</strong></p>
  `
}
