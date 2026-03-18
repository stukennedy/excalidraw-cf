import type { ExcalidrawElement } from './elements';

// Client -> Server messages
export type ClientMessage =
  | { type: 'element-update'; elements: ExcalidrawElement[] }
  | { type: 'element-delete'; elementIds: string[] }
  | { type: 'cursor-move'; userId: string; x: number; y: number; username: string }
  | { type: 'request-sync' }
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'element-update'; elements: ExcalidrawElement[]; senderId: string }
  | { type: 'element-delete'; elementIds: string[]; senderId: string }
  | { type: 'cursor-move'; userId: string; x: number; y: number; username: string }
  | { type: 'full-sync'; elements: ExcalidrawElement[] }
  | { type: 'pong' }
  | { type: 'user-joined'; userId: string; username: string; userCount: number }
  | { type: 'user-left'; userId: string; userCount: number };
