import { store } from './state';
import { history } from './history';
import { wsClient } from './ws-client';

function getOrderedElements() {
  return Array.from(store.elements.values());
}

export function bringToFront(): void {
  const selected = store.appState.selectedElementIds;
  if (selected.size === 0) return;

  history.capture();
  const elements = getOrderedElements();
  const toMove = elements.filter(el => selected.has(el.id));
  const rest = elements.filter(el => !selected.has(el.id));

  store.elements = new Map([...rest, ...toMove].map(el => [el.id, el]));
  store.notify();
}

export function sendToBack(): void {
  const selected = store.appState.selectedElementIds;
  if (selected.size === 0) return;

  history.capture();
  const elements = getOrderedElements();
  const toMove = elements.filter(el => selected.has(el.id));
  const rest = elements.filter(el => !selected.has(el.id));

  store.elements = new Map([...toMove, ...rest].map(el => [el.id, el]));
  store.notify();
}

export function bringForward(): void {
  const selected = store.appState.selectedElementIds;
  if (selected.size === 0) return;

  history.capture();
  const elements = getOrderedElements();
  const result = [...elements];

  for (let i = result.length - 2; i >= 0; i--) {
    if (selected.has(result[i].id) && !selected.has(result[i + 1].id)) {
      [result[i], result[i + 1]] = [result[i + 1], result[i]];
    }
  }

  store.elements = new Map(result.map(el => [el.id, el]));
  store.notify();
}

export function sendBackward(): void {
  const selected = store.appState.selectedElementIds;
  if (selected.size === 0) return;

  history.capture();
  const elements = getOrderedElements();
  const result = [...elements];

  for (let i = 1; i < result.length; i++) {
    if (selected.has(result[i].id) && !selected.has(result[i - 1].id)) {
      [result[i - 1], result[i]] = [result[i], result[i - 1]];
    }
  }

  store.elements = new Map(result.map(el => [el.id, el]));
  store.notify();
}
