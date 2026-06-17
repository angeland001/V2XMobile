/**
 * Enum representing possible approach directions to an intersection
 */
export enum ApproachDirection {
    NORTH = 'NORTH',
    SOUTH = 'SOUTH',
    EAST = 'EAST',
    WEST = 'WEST',
    UNKNOWN = 'UNKNOWN'
  }
  
  /**
   * Enum representing possible turn types at an intersection
   */
  export enum TurnType {
    LEFT = 'LEFT',
    STRAIGHT = 'STRAIGHT',
    RIGHT = 'RIGHT',
    U_TURN = 'U_TURN'
  }
  
  /**
   * Interface representing an allowed/disallowed turn
   */
  export interface AllowedTurn {
    type: TurnType;
    allowed: boolean;
  }

export default {};