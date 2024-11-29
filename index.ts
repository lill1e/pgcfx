import { Client } from "pg"

let dbHost: string = GetConvar("postgres_host", "")
let dbPort: number = GetConvarInt("postgres_port", -1)
let dbUsername: string = GetConvar("postgres_username", "")
let dbPassword: string = GetConvar("postgres_password", "")
let dbDatabase: string = GetConvar("postgres_database", "")

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
        })
} else {
    console.log("PostgresSQL config not properly set in server.cfg")
    StopResource(GetCurrentResourceName())
}

exports("goofyFn", (n: number) => {
    console.log(`some var n: ${n}`)
    return "hehe"
})

exports("insert", (table: string, columnNames: string[], columnValues: string[]): Promise<boolean> => {
    return new Promise(resolve => {
        let columnValuesStr = [...Array(columnValues.length).keys()].map(n => `$${n + 1}`).join(", ")
        sql_conn.query(`INSERT INTO ${table}(${columnNames.join(", ")}) VALUES(${columnValuesStr})`, columnValues)
            .then(data => resolve(data.rowCount != null && data.rowCount > 0))
            .catch(e => {
                console.log(e)
                resolve(false)
            })
    })
})

exports("select", (table: string, columns: string[], predicate?: string, predicateValues?: string[]): Promise<object[]> => {
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
            .then(resolve)
            .catch(e => {
                console.log(e)
                resolve([])
            })
    })
})
