export interface ApiResponse<T=unknown> {
    success : boolean
    status : number
    message : string
    data? : T
    error? : string
}