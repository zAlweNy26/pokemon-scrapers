-- void:allow-destructive
-- Drops only an index, no data: it misled the planner into reading ~500k rows per `?depositable=` list.
DROP INDEX `form_depositable_idx`;