import { Client } from "pg"

let dbHost: string = GetConvar("postgres_host", "")
let dbPort: number = GetConvarInt("postgres_port", -1)
let dbUsername: string = GetConvar("postgres_username", "")
let dbPassword: string = GetConvar("postgres_password", "")
let dbDatabase: string = GetConvar("postgres_database", "")
let isConnected: boolean = false

const sql_conn = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUsername,
    password: dbPassword,
    database: dbDatabase
})

if (dbHost != "" && dbPort != -1 && dbUsername != "" && dbPassword != "" && dbDatabase != "") {
    sql_conn.connect()
        .then(_ => {
            console.log(`PostgresSQL connected (database: ${dbDatabase})`)
            emit("pg:connected")
            isConnected = true
        })
        .catch(e => {
            console.log(e)
            StopResource(GetCurrentResourceName())
        })
} else {
    console.log("PostgresSQL config not properly set in server.cfg")
    StopResource(GetCurrentResourceName())
}

exports("ready", (callback: () => void) => {
    while (!isConnected) { }
    callback()
})

exports("insert", (table: string, columnNames: string[], columnValues: string[]): Promise<boolean> => {
    return new Promise(resolve => {
        let columnValuesStr = [...Array(columnValues.length).keys()].map(n => `$${n + 1}`).join(", ")
        sql_conn.query(`INSERT INTO ${table}(${columnNames.join(", ")}) VALUES(${columnValuesStr})`, columnValues)
            .then(data => resolve(data.rowCount != null && data.rowCount > 0))
            .catch(e => {
                console.log(e)
                resolve(0)
            })
    })
})

function selectQuery(table: string, columns: string[], single: boolean, predicate?: string, predicateValues?: string[]): Promise<object[] | object> {
    return new Promise(resolve => {
        let columnStr: string = ""
        if (columns.length == 0) columnStr = "*"
        else columnStr = columns.join(", ")
        let newPredicate: string = ""
        if (predicate != undefined) {
            if (predicate.length > 0) newPredicate = "WHERE "
            let counter = 1
            for (let i = 0; i < predicate.length; i++) {
                if (predicate.charAt(i) == "?") {
                    newPredicate += `$${counter++}`
                } else {
                    newPredicate += predicate.charAt(i)
                }
            }
        }
        sql_conn.query(`SELECT ${columnStr} FROM ${table} ${newPredicate}`, predicateValues == undefined ? [] : predicateValues)
            .then(res => res.rows)
            .then(rows => single ? (rows.length > 0 ? rows[0] : null) : rows)
            .then(resolve)
            .catch(e => {
                console.log(e)
                resolve(single ? null : [])
            })
    })
}

exports("select", (table: string, columns: string[], predicate?: string, predicateValues?: string[]): Promise<object[] | object> => {
    return selectQuery(table, columns, false, predicate, predicateValues)
})

exports("selectOne", (table: string, columns: string[], predicate?: string, predicateValues?: string[]): Promise<object> => {
    return selectQuery(table, columns, true, predicate, predicateValues)
})

exports("delete", (table: string, predicate?: string, predicateValues?: string[]): Promise<boolean> => {
    return new Promise(resolve => {
        let newPredicate: string = ""
        if (predicate != undefined) {
            if (predicate.length > 0) newPredicate = "WHERE "
            let counter = 1
            for (let i = 0; i < predicate.length; i++) {
                if (predicate.charAt(i) == "?") {
                    newPredicate += `$${counter++}`
                } else {
                    newPredicate += predicate.charAt(i)
                }
            }
        }
        sql_conn.query(`DELETE FROM ${table} ${newPredicate}`, predicateValues == undefined ? [] : predicateValues)
            .then(data => resolve(data.rowCount != null ? data.rowCount : 0))
            .catch(e => {
                console.log(e)
                resolve(0)
            })
    })
})

exports("update", (table: string, updatedColumns: string[], updatedValues: string[], predicate?: string, predicateValues?: string[]): Promise<boolean> => {
    return new Promise(resolve => {
        let setStr: string = [...Array(updatedColumns.length).keys()].map(n => `${updatedColumns[n]} = $${n + 1}`).join(", ")
        let newPredicate: string = ""
        if (predicate != undefined) {
            if (predicate.length > 0) newPredicate = "WHERE "
            let counter = updatedColumns.length + 1
            for (let i = 0; i < predicate.length; i++) {
                if (predicate.charAt(i) == "?") {
                    newPredicate += `$${counter++}`
                } else {
                    newPredicate += predicate.charAt(i)
                }
            }
        }
        sql_conn.query(`UPDATE ${table} SET ${setStr} ${newPredicate}`, [...updatedValues, ...predicateValues == undefined ? [] : predicateValues])
            .then(data => resolve(data.rowCount != null ? data.rowCount : 0))
            .catch(e => {
                console.log(e)
                resolve(0)
            })
    })
})
