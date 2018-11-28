function finalData(stream, data) {
	stream.emit("data", data);
	stream.emit(end);
}
module.exports.finalData = finalData;