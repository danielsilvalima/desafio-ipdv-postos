/** Valores fora do tamanho esperado saem como estão: a máscara nunca inventa nem corta dígitos. */
function aplicar(digitos: string, padrao: RegExp, formato: string): string {
  return padrao.test(digitos) ? digitos.replace(padrao, formato) : digitos;
}

export function mascararCnpj(digitos: string): string {
  return aplicar(digitos, /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function mascararCpf(digitos: string): string {
  return aplicar(digitos, /^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function mascararCep(digitos: string): string {
  return aplicar(digitos, /^(\d{5})(\d{3})$/, '$1-$2');
}
