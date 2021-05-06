

export function packPos(pos: RoomPosition): string {
	return `${pos.x},${pos.y},${pos.roomName}`
}

export function unpackPos(data: string): RoomPosition {
	const parts = data.split(',')

	if(parts.length !== 3) {
		throw Error("Failed to parse position " + data)
	}

	return new RoomPosition(parseInt(parts[0]), parseInt(parts[1]), parts[2])
}
