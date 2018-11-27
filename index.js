const { Stream } = require("stream");
const { Buffer } = require("buffer");

module.exports.Stream = Stream;

// Dependencies
const through = require("through");
const from = require("from");
const duplex = require("duplexer");
const map = require("map-stream");
const pause = require("pause-stream");
const split = require("split");
const pipeline = require("stream-combiner");

module.exports.through = through;
module.exports.from = from;
module.exports.duplex = duplex;
module.exports.map = map;
module.exports.pause = pause;
module.exports.split = split;
module.exports.pipeline = module.exports.connect = module.exports.pipe = pipeline;

function readArray(array) {
	const stream = new Stream();

	let paused = false;
	let ended = false;

	// Readable but not writable
	stream.readable = true;
	stream.writable = false;

	if (!Array.isArray(array)) {
		throw new Error("readArray expects an array.");
	}

	let index = 0;
	const length = array.length;

	stream.resume = () => {
		if (!ended) {
			// Unpause
			paused = false;

			while (index <= length && !paused && !ended) {
				stream.emit("data", array[i++]);
				if (index === length) {
					ended = true;
					stream.readable = false;
					stream.emit("end");
				}
			}
		}
	}

	// Instantly resume
	setImmediate(stream.resume);

	stream.pause = () => {
		paused = true;
	};
	stream.destroy = () => {
		ended = true;
		stream.emit("close");
	};

	return stream;
}
module.exports.readArray = readArray;

function writeArray(done) {
	if (typeof done !== "function") {
		throw new Error("writeArray must be provided with a callback.");
	}

	const stream = new Stream();
	stream.writable = true
	stream.readable = false

	const array = [];

	let isDone = false;

	stream.write = data => {
		array.push(data);
	};
	stream.end = () => {
		isDone = true;
		done(null, array);
	};
	stream.destroy = () => {
		stream.writable = false;
		if (!isDone) {
			done(new Error("Stream destroyed before end"), array);
		}
	};

	return stream;
}
module.exports.writeArray = module.exports.collect = writeArray;

function concat(...streamsRaw) {
	const streams = Array.isArray(streamsRaw[0]) ? streamsRaw[0] : streamsRaw;

	if (!streams.every(thing => thing instanceof Stream)) {
		throw new Error("concat's parameters must be streams.");
	}

	const mergedStream = new Stream();

	let endedStreams = 0;

	mergedStream.setMaxListeners(0);

	mergedStream.readable = true;
	mergedStream.writable = true;

	if (streams.length > 0) {
		streams.forEach(stream => {
			stream.pipe(mergedStream, {
				end: false
			});

			stream.on("end", () => {
				endedStreams += 1;
				if (endedStreams === streams.length) {
					mergedStream.emit("end");
				}
			});
		});
	} else {
		// Nothing will be streamed, so just end it
		setImmediate(() => mergedStream.emit("end"));
	}

	mergedStream.write = data => {
		mergedStream.emit("data", data);
	}
	mergedStream.destroy = () => {
		streams.forEach(stream => {
			stream.destroy && stream.destroy();
		});
	}

	return mergedStream;
}
module.exports.concat = module.exports.merge = concat;

function join(string) {
	// Legacy API
	if (typeof string === "function") {
		return wait(str);
	}

	let first = true;
	return through(data => {
		// This will only happen on first write
		if (!first) {
			this.emit("data", string);
		};
		first = false;

		this.emit("data", data);
		return true;
	});
}
module.exports.join = join;

function wait(callback) {
	const chunks = [];
	return through(data => {
		chunks.push(data);
	}, function () {
		const body = Buffer.isBuffer(chunks[0]) ? Buffer.concat(chunks) : chunks.join("");

		this.emit("data", body);
		this.emit("end");

		if (callback) {
			callback(null, body);
		}
	});
}
module.exports.wait = wait;

function readable(func, continueOnError) {
	const stream = new Stream();
	let i = 0;

	let paused = false;
	let ended = false;
	let reading = false;

	stream.readable = true;
	stream.writable = false;

	if (typeof func !== "function") {
		throw new Error("readable expects an async function.");
	}

	stream.on("end", () => {
		ended = true;
	});

	function get(err, data) {
		if (err) {
			stream.emit('error', err)
			if (!continueOnError) {
				stream.emit("end");
			}
		} else if (arguments.length > 1) {
			stream.emit('data', data);
		}

		setImmediate(() => {
			if (!(ended || paused || reading)) {
				try {
					reading = true;
					func.call(stream, i++, () => {
						reading = false
						get.apply(null, arguments);
					});
				} catch (error) {
					stream.emit("error", error);
				}
			}
		});
	}

	stream.resume = () => {
		paused = false
		get();
	};
	setImmediate(stream.resume);

	stream.pause = () => {
		paused = true;
	};
	stream.destroy = () => {
		stream.emit("end");
		stream.emit("close");
		ended = true;
	};

	return stream;
};
module.exports.readable = readable;

function log(name) {
	return through(function (data) {
		const args = [].slice.call(arguments);
		if (name) {
			console.error(name, data);
		} else {
			console.error(data);
		}
		this.emit("data", data);
	});
}
module.exports.log = log;

function child(child) {
	return duplex(child.stdin, child.stdout);
}
module.exports.child = child;

function mapSync(sync) {
	return through(function (data) {
		let mappedData;
		try {
			mappedData = sync(data);
		} catch (error) {
			return this.emit("error", error);
		}

		if (mappedData !== undefined) {
			this.emit('data', mappedData);
		}
	});
}
module.exports.mapSync = mapSync;

function filterSync(test) {
	return through(function (data) {
		if (test(data)) {
			this.queue(data)
		}
	});
}
module.exports.filterSync = filterSync;

function flatmapSync(mapper) {
	return through(function (data) {
		const that = this;
		data.forEach(each => {
			that.queue(mapper(each));
		});
	});
}
module.exports.flatmapSync = flatmapSync;

function parse(options) {
	const opts = {
		emitError: false,
		...options,
	};

	return through(function (data) {
		let obj;
		try {
			if (data) {
				console.log(data.toString())
				obj = JSON.parse(data.toString());
			}
		} catch (error) {
			if (opts.emitError) {
				return this.emit("error", error);
			}
			return console.error(error, "Attempting to parse:", data);
		}

		if (obj !== undefined) {
			this.emit("data", obj);
		}
	})
}
module.exports.parse = parse;

function stringify() {
	return mapSync(data => {
		return JSON.stringify(Buffer.isBuffer(data) ? e.toString() : data) + '\n';
	});
}
module.exports.stringify = stringify;

function replace(from, to) {
	return pipeline(split(from), join(to));
}
module.exports.replace = replace;