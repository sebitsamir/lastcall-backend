// Standardizes all API responses so the frontend always gets
//a predictable JSON structure.
class ApiResponse {
    static success(res, data, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            status: 'success',
            message,
            data,
        });
    }

    static created(res, data, message = 'Created successfully') {
        return ApiResponse.success(res, data, message, 201);
    }

    static noContent(res) {
        return res.status(204).end();
    }
}

module.exports = ApiResponse;