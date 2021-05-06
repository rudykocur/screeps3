

export function getPositionsAround(center: RoomPosition) {
    return [
        new RoomPosition(center.x -1, center.y -1, center.roomName),
        new RoomPosition(center.x -1, center.y, center.roomName),
        new RoomPosition(center.x -1, center.y +1, center.roomName),
        new RoomPosition(center.x, center.y -1, center.roomName),
        new RoomPosition(center.x, center.y +1, center.roomName),
        new RoomPosition(center.x +1, center.y -1, center.roomName),
        new RoomPosition(center.x +1, center.y, center.roomName),
        new RoomPosition(center.x +1, center.y +1, center.roomName),
    ];
}
