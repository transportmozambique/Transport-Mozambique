/**
 * Como se lê uma resposta USSD. O USSD não guarda sessão: a Africa's Talking reenvia em `text`
 * todas as teclas escritas até agora ("1*museu*2*7*1"). Um menu é uma função que, a partir das
 * respostas até agora, dá o ecrã a mostrar a seguir; replay() passa as teclas por esses ecrãs uma
 * a uma, para que cada tecla seja lida como o ecrã a que respondeu a pede:
 *
 *   ask   qualquer texto é a resposta (um nome, uma matrícula); 0 volta atrás
 *   list  o número de um item; 7 e 8 a página seguinte e a anterior; 0 volta atrás; outro número
 *         de um ou dois algarismos mostra a mesma lista outra vez. Numa lista de resultados de uma
 *         pesquisa, qualquer outro texto é uma nova pesquisa: quem vê os locais errados escreve
 *         outro nome, sem ter de recomeçar
 *   keys  só as teclas que oferece, e 0
 *   end   o último ecrã; a sessão acabou
 *
 * Porquê repetir tudo a cada pedido em vez de guardar a sessão: as funções serverless não guardam
 * memória entre pedidos, e uma tabela de sessões seria mais uma escrita por tecla e mais um sítio
 * onde a sessão se perde. Com a repetição, o mesmo `text` dá sempre o mesmo ecrã.
 *
 * Explicação com exemplos: docs/ussd.md#leitura-das-teclas
 */

/** Os telemóveis mostram no máximo 182 caracteres por ecrã USSD (o texto depois de CON/END) */
export const USSD_MAX = 182;
export const PAGE_SIZE = 6;

export interface Answer {
  /** O que foi escrito */
  text: string;
  /** Numa lista: a posição do item escolhido na lista inteira (todas as páginas) */
  index?: number;
}

/** Corre só quando o ecrã é o mostrado (não enquanto as teclas anteriores são repetidas): um SMS não sai duas vezes */
type Effect = () => Promise<unknown> | unknown;

export type Screen =
  /** `retype`: a resposta substitui a anterior (uma nova pesquisa depois de "nada encontrado") */
  | { kind: 'ask'; text: string; retype?: boolean; effect?: Effect }
  | { kind: 'list'; title: string; items: string[]; size?: number; retype?: boolean; effect?: Effect }
  | { kind: 'keys'; text: string; keys: string[]; effect?: Effect }
  | { kind: 'end'; text: string; effect?: Effect };

export type Menu = (answers: Answer[]) => Promise<Screen>;

export type Replayed =
  | { screen: Screen; page: number }
  /** 0 no primeiro ecrã do menu: de volta ao menu principal, e depois estas teclas */
  | { back: string[] }
  | { invalid: true };

export async function replay(menu: Menu, keys: string[]): Promise<Replayed> {
  const answers: Answer[] = [];
  let page = 0;
  let screen = await menu(answers);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k].trim();
    if (screen.kind === 'end') return { invalid: true };

    if (key === '0') {
      if (!answers.length) return { back: keys.slice(k + 1) };
      answers.pop();
    } else if (screen.kind === 'ask') {
      if (screen.retype) answers.pop();
      answers.push({ text: key });
    } else if (screen.kind === 'keys') {
      if (!screen.keys.includes(key)) return { invalid: true };
      answers.push({ text: key });
    } else {
      const size = screen.size ?? PAGE_SIZE;
      const pages = Math.ceil(screen.items.length / size);
      const n = /^\d+$/.test(key) ? Number(key) : NaN;
      // 7 e 8 ficam no mesmo ecrã (na última ou na primeira página não fazem nada)
      if (key === '7' || key === '8') {
        page = key === '7' ? Math.min(page + 1, pages - 1) : Math.max(page - 1, 0);
        continue;
      }
      if (n >= 1 && n <= size && page * size + n - 1 < screen.items.length) {
        answers.push({ text: key, index: page * size + n - 1 });
      } else if (/^\d{1,2}$/.test(key)) {
        continue; // um número que não está na lista: a mesma lista outra vez
      } else if (screen.retype && key) {
        answers.pop(); // a pesquisa a que esta lista respondia
        answers.push({ text: key });
      } else {
        return { invalid: true };
      }
    }
    page = 0;
    screen = await menu(answers);
  }
  return { screen, page };
}

export function cutText(text: string, max: number): string {
  return text.length > max ? text.slice(0, Math.max(1, max - 2)) + '..' : text;
}

/** Uma página de `list` com os itens numerados, encurtados para o ecrã caber em USSD_MAX. */
export function paginateList(title: string, list: string[], currentPage: number, size = PAGE_SIZE): string {
  const totalPages = Math.ceil(list.length / size);
  const pageItems = list.slice(currentPage * size, (currentPage + 1) * size);
  const nav = [
    currentPage < totalPages - 1 ? '7. Proximo' : null,
    currentPage > 0 ? '8. Anterior' : null,
    '0. Voltar',
  ].filter(Boolean).join('\n');

  // Espaço que sobra para os nomes: cada linha tem ainda "n. " e uma quebra de linha
  const room = USSD_MAX - title.length - 1 - nav.length;
  const perItem = Math.max(8, Math.floor(room / Math.max(1, pageItems.length)) - 4);
  const items = pageItems.map((item, i) => `${i + 1}. ${cutText(item, perItem)}`).join('\n');
  return `CON ${title}\n${items}\n${nav}`;
}

/** O texto devolvido à Africa's Talking para um ecrã: CON mantém a sessão aberta, END fecha-a. */
export function render(screen: Screen, page: number): string {
  switch (screen.kind) {
    case 'ask':
      return `CON ${screen.text}\n0. Voltar`;
    case 'keys':
      return `CON ${screen.text}`;
    case 'list':
      return paginateList(screen.title, screen.items, page, screen.size);
    case 'end':
      return `END ${screen.text}`;
  }
}
