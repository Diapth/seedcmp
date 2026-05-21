import mitt from 'mitt';

export type Events = {
  kickout: void;
};

export const eventBus = mitt<Events>();
