const parseNumericFields = (row) => {
  if (!row) return row;

  const numericFields = [
    'total_bill_amount',
    'amount_paid',
    'credit_amount',
    'purchase_price',
    'sell_price',
    'stock',
    'added_stock',
    'quantity',
    'unit_price',
    'subtotal',
    'total_price',
    'total_sales',
    'sales_volume',
  ];

  const parsedRow = { ...row };
  for (const field of numericFields) {
    if (Object.prototype.hasOwnProperty.call(parsedRow, field) && parsedRow[field] !== null) {
      if (field === 'added_stock' || field === 'quantity' || field === 'stock' || field === 'sales_volume') {
        parsedRow[field] = parseInt(parsedRow[field], 10);
      } else {
        parsedRow[field] = parseFloat(parsedRow[field]);
      }
      if (isNaN(parsedRow[field])) {
        parsedRow[field] = 0;
      }
    }
  }
  return parsedRow;
};

const generateInvoiceNumber = () => {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

module.exports = { parseNumericFields, generateInvoiceNumber };