import type { RScene } from '../render/types';
import { clusterScheduler } from './cluster-scheduler';
import { facemesh } from './facemesh';
import { kbsync } from './kbsync';
import { quizzera } from './quizzera';
import { quorumdb } from './quorumdb';

export const scenes: Record<string, RScene> = {
  quorumdb,
  'cluster-scheduler': clusterScheduler,
  kbsync,
  facemesh,
  quizzera,
};
