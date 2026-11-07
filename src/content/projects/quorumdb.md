---
title: QuorumDB
order: 1
category: Distributed systems
blurb: A Redis-compatible database that keeps every piece of data on three computers, with Raft written from scratch in Go.
summary: A database that keeps every piece of data on three computers, so it keeps working when one of them fails. It speaks the Redis protocol, runs across three Google Cloud data centers, and I wrote the Raft layer that keeps the copies in agreement myself.
pill: 0 lost writes in 200 chaos runs
repo: https://github.com/simar-s2/quorumdb
stack: [Go, Raft, Docker, Kubernetes, Terraform, Google Cloud]
results:
  - label: Confirmed writes lost
    value: '0'
    note: Of 666,283 checked across 200 chaos runs, 100 on my laptop and 100 on Google Cloud.
  - label: Failures injected
    value: '1,129'
    note: Crashes, freezes and network cuts, all caused while the cluster kept taking writes.
  - label: Time to a new leader
    value: 489 ms
    note: Typical on my laptop. 817 ms typical with each node in a different Google Cloud zone.
  - label: Writes per second
    value: '55,371'
    note: On Google Cloud, sending 16 at a time. 167,504 on my laptop.
problem:
  - One database server is one failure away from an outage. Keeping copies on other computers helps, but copies alone create a harder problem. They have to agree on the order of every write, a leader that has been cut off must not keep answering, and a crash in the middle of a save can't lose anything the client was told was saved.
  - I wanted to build the part that solves this myself and then try hard to break it. The goal was a number anyone can check, "0 lost out of N", measured while things are failing on purpose.
pipeline:
  - name: RESP
    note: speaks the Redis protocol
  - name: Route
    note: followers forward to the leader
  - name: Log
    note: append, send to both followers
  - name: fsync
    note: on disk before it counts
  - name: Quorum
    note: 2 of 3 saved, reply OK
  - name: Apply
    note: update the key-value store
---

Three nodes run the same Go program. Each one speaks the Redis protocol, so `redis-cli` and every Redis library work with it unchanged. A client can connect to any node, and a follower forwards the request to the leader.

When a save reaches the leader, it appends the entry to its log and sends it to both followers while it fsyncs its own copy. The leader only counts itself toward the majority after that fsync finishes. Once two of the three have the entry on disk, it is committed and applied, and the client gets "OK". Saves that arrive together share one round trip and one fsync, which is why sending 16 at a time is more than 6x faster.

Reads go through the leader too. Before answering, it runs a ReadIndex round: a heartbeat that confirms a majority still follows it. A leader that has been cut off can't get that confirmation, so it can't answer with old data.

If the leader goes quiet for about half a second, the followers run a pre-vote and then an election. A node that crashed loads its snapshot, replays its write-ahead log, and catches up from the leader.

On Google Cloud it runs as a Kubernetes StatefulSet on a regional GKE cluster in `us-west1`, one node per zone. Terraform builds everything with `make up` and deletes it with `make down`.

## Decisions

- **Three zones, not two.** The database needs two of three nodes. With two zones, one zone holds two nodes, and losing it loses the majority. With three, any one zone can fail.
- **A StatefulSet, not a Deployment.** A node's data belongs to its identity, so it must come back with the same name and the same disk. A Deployment gives pods random names.
- **No CPU limit.** Kubernetes enforces a CPU limit by pausing the program, which could delay the leader's heartbeats and cause needless elections. Each node is still guaranteed 1 CPU.
- **"Ready" means "knows the leader".** A node without a leader can't save anything or give a guaranteed up-to-date answer, so Kubernetes shouldn't send it traffic.
- **A real crash, not a polite one.** Deleting a pod asks the program to stop, and it saves everything first. The test kills the process instantly, then deletes the pod.

## How I tested it

The chaos test crashes nodes, freezes them and cuts their network while clients keep working. After each run it checks that every save that got "OK" is still there, runs every answer through the [porcupine](https://github.com/anishathalye/porcupine) linearizability checker, and confirms all three nodes ended with the same data.

| | On my laptop | On Google Cloud |
|---|---|---|
| Runs where every check passed | **100 / 100** | **100 / 100** |
| Saves that got "OK" but were lost | **0** of 87,994 | **0** of 578,289 |
| Wrong answers found | **0** | **0** |
| Problems caused on purpose | 626 | 503 |
| Time to a new leader, typical | 489 ms | 817 ms |
| Time to a new leader, slowest | 1,109 ms | 2,782 ms |
| Saves per second | 25,294 | 8,455 |
| Reads per second | 82,169 | 20,173 |
| Saves per second, 16 at a time | 167,504 | 55,371 |

To check the test itself, I also ran it against two versions I broke on purpose: one that says "OK" too early and one that reads local state without asking the majority. It caught both, in 10 of 10 runs each.

Speed numbers are the middle of 3 runs of `redis-benchmark`, from 50 connections to the leader. Google Cloud is slower because every save has to travel between buildings before it gets "OK".

## Things I learned

- **Check that the problem you caused really happened.** On Google Cloud, my network cuts silently did nothing, because Google's network ignores the name tag my rules used to pick a pod. Timing how long a new leader took to appear is what revealed it.
- **Test the old version before blaming the new one.** My speed results dropped after a change. The old version was just as slow, because the laptop's Low Power Mode was on.
- **A crash test has to be a real crash.** Asking a program to stop lets it save everything first. To test crash recovery, the test has to kill it instantly.

## Known limits

- There is no password or encryption yet, so it only runs inside the cluster.
- The number of nodes is set at startup. Asking Kubernetes for five replicas wouldn't add them to the group.
- A disk can only attach to a computer in its own zone, so if a whole zone goes down, that node waits for the zone to return. The other two keep running.

## Run it

```bash
make cluster-up                        # start the three computers
redis-cli -p 6379 SET user:42 alice    # save on one
redis-cli -p 6381 GET user:42          # read from another: "alice"
make kill-leader                       # crash the leader; a new one takes over
make chaos                             # run the chaos test
```
