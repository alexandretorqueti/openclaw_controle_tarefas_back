declare const z: any;
declare const uuidSchema: any;
declare const createCommentSchema: any;
declare const updateCommentSchema: any;
declare function validateComment(data: any): {
    success: boolean;
    error: {
        message: string;
        errors: any;
    };
    data?: undefined;
} | {
    success: boolean;
    data: any;
    error?: undefined;
};
declare function validateCommentUpdate(data: any): {
    success: boolean;
    error: {
        message: string;
        errors: any;
    };
    data?: undefined;
} | {
    success: boolean;
    data: any;
    error?: undefined;
};
