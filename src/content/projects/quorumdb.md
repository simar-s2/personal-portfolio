---
title: QuorumDB
order: 1
category: Distributed systems
blurb: Redis-compatible key-value store in Go, replicated across three Google Cloud zones with Raft I wrote from scratch.
summary: A Redis-compatible key-value store in Go. Every write is replicated to three nodes with Raft, which I implemented from scratch, and the cluster runs on GKE with one node in each of three Google Cloud zones. It keeps taking writes when a node or a whole zone goes down.
pill: 0 lost writes in 100 chaos tests
repo: https://github.com/simar-s2/quorumdb
stack: [Go, Raft, Docker, Kubernetes, Terraform, Google Cloud]
results:
  - label: Confirmed writes lost
    value: '0'
    note: In 100 chaos tests with each node in a different Google Cloud zone.
  - label: Failures injected
    value: '675'
    note: Crashes, freezes and network splits across zones, all while clients kept writing.
  - label: Writes per second
    value: 38K
    note: Across three Google Cloud zones, with automatic leader failover.
  - label: Reads per second
    value: 116K
    note: Across zones, with no stale reads even when the leader is cut off.
problem:
  - A single Redis server loses data when it crashes. Copying writes to other machines only helps if the copies agree on the order of writes, a leader that gets cut off stops answering, and a crash halfway through a write can't lose anything the client was told was saved.
  - QuorumDB handles those cases with Raft, and a chaos test checks all of them while it injects failures.
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

Each node runs the same Go binary and speaks RESP, so `redis-cli` and existing Redis clients work without changes. A client can connect to any node, and followers forward requests to the leader.

On a write, the leader appends the entry to its log and sends it to both followers while it fsyncs its own copy. It only counts its own vote after the fsync. Once two of the three nodes have the entry on disk, it commits, gets applied to the key-value store, and the client gets `OK`. Writes that arrive together share one round trip and one fsync.

Reads also go through the leader. Before answering, it runs a ReadIndex round, a heartbeat that confirms a majority still follows it. A leader that has been cut off can't get that confirmation, so it can't serve stale data.

If the followers hear nothing from the leader for about half a second, they run a pre-vote and then an election. A node that restarts loads its snapshot, replays its write-ahead log and catches up from the leader.

On Google Cloud the nodes run as a Kubernetes StatefulSet on a regional GKE cluster in `us-west1`, one per zone. Terraform creates everything with `make up` and deletes it with `make down`.

## Design decisions

- **Three zones.** A quorum is two of three nodes. With only two zones, one zone would hold two nodes and losing it would lose the quorum.
- **StatefulSet.** A node's data belongs to its identity, so a restarted pod needs the same name and the same persistent disk. A Deployment gives pods random names.
- **No CPU limit.** Kubernetes enforces CPU limits by throttling the process, which can delay heartbeats and start elections for no reason. Each node still requests 1 CPU.
- **Ready means it knows the leader.** A node without a leader can't commit writes or serve linearizable reads, so Kubernetes shouldn't send it traffic.
- **Hard kills in the tests.** Deleting a pod lets the process shut down cleanly and flush first. The chaos test kills the process immediately, then deletes the pod.

## Testing

The chaos test crashes, freezes and partitions nodes while clients keep writing. After each test it checks that every acknowledged write is still there, runs the full history through the [porcupine](https://github.com/anishathalye/porcupine) linearizability checker, and confirms all three nodes ended with the same data.

| Across three Google Cloud zones | Result |
|---|---|
| Chaos tests where every check passed | **100 / 100** |
| Writes that got "OK" and were then lost | **0** |
| Stale reads, even with the leader cut off | **0** |
| Crashes, freezes and network splits injected | 675 |
| Time to a new leader, typical | 817 ms |
| Time to a new leader, slowest | 2,782 ms |
| Writes per second | 38K |
| Reads per second | 116K |

To make sure the test catches real bugs, I also ran it against two builds I broke on purpose: one that replies `OK` before the write commits, and one that reads local state without a ReadIndex round. It caught both in 10 of 10 runs.

## Known limits

- No authentication or TLS yet, so it only runs inside the cluster.
- Cluster size is fixed at startup. Scaling the StatefulSet doesn't add members to the Raft group.
- Persistent disks are zonal, so if a zone goes down, that node waits for the zone to come back. The other two keep serving.

## Run it

```bash
make cluster-up                        # start three nodes
redis-cli -p 6379 SET user:42 alice    # write to one
redis-cli -p 6381 GET user:42          # read from another: "alice"
make kill-leader                       # crash the leader; a new one takes over
make chaos                             # run the chaos test
```
