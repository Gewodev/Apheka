import {createContext} from 'react';
/** Pause hidden visual subscriptions, never the underlying timer or persistence. */
export const ViewActivity=createContext(true);
